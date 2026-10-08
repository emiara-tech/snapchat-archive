import {
	buildSnapZipIndex,
	findDuplicateSnapZipPaths,
	findSnapZipEntriesByPrefix,
	findSnapZipEntryByPath,
	readSnapZipEntryContent,
	type SnapZipIndex,
	type SnapZipSource,
	type SnapZipEntryId,
	type BuildIndexOptions,
	assertNotAborted,
} from "./snapZip";
import {
	type ArchiveCapabilities,
	type ArchiveDiagnostics,
	type ArchiveMetadata,
} from "../types";
import {
	EXPECTED_SNAPCHAT_JSON_PATHS,
	SNAPCHAT_JSON_PATHS,
} from "./snapchatArchivePaths";
import { parseAccountJson, parseFriendsJson } from "./snapchatParsers";

export interface ArchiveSession {
	index: SnapZipIndex;
	reader: SnapchatArchiveReader;
	metadata: ArchiveMetadata;
}

export type ArchiveProgressCallback = (
	progress: number,
	status: string,
) => void;

export const SNAP_JSON_PATHS = SNAPCHAT_JSON_PATHS;

export class SnapchatArchiveReader {
	readonly index: SnapZipIndex;
	private readonly controller = new AbortController();
	private readonly urls = new Set<string>();
	private disposed = false;

	constructor(index: SnapZipIndex) {
		this.index = index;
	}

	async readJsonFile<T>(path: string): Promise<T | null> {
		this.assertActive();
		const entries = this.index.entries.filter((entry) => entry.id.path === path && !entry.isDirectory);
		if (!entries.length) return null;
		let result: T | null = null;
		let previous: string | null = null;
		for (const entry of entries) {
			const buffer = await this.readEntry(entry.id, 128 * 1024 * 1024);
			const text = new TextDecoder("utf-8").decode(buffer);
			if (previous !== null && previous !== text) throw new DuplicateArchivePathError();
			result = JSON.parse(text) as T;
			previous = text;
		}
		return result;
	}

	async readMediaBlob(path: string): Promise<string | null> {
		this.assertActive();
		const entries = this.index.entries.filter((entry) => entry.id.path === path && !entry.isDirectory);
		if (!entries.length) return null;
		if (entries.length !== 1) throw new DuplicateArchivePathError();
		return this.readMediaEntry(entries[0]!.id);
	}

	async readEntry(id: SnapZipEntryId, maxBytes?: number): Promise<ArrayBuffer> {
		this.assertActive();
		const content = await readSnapZipEntryContent(this.index, id, { signal: this.controller.signal, maxBytes });
		const buffer = await normalizeContentToArrayBuffer(content);
		this.assertActive();
		return buffer;
	}

	async readMediaEntry(id: SnapZipEntryId): Promise<string> {
		const buffer = await this.readEntry(id);
		const url = URL.createObjectURL(
			new Blob([buffer], { type: mimeTypeForPath(id.path) }),
		);
		this.urls.add(url);
		return url;
	}

	releaseMediaUrl(url: string) {
		if (this.urls.delete(url)) URL.revokeObjectURL(url);
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.controller.abort();
		for (const url of this.urls) URL.revokeObjectURL(url);
		this.urls.clear();
	}

	private assertActive() {
		if (this.disposed) throw new DOMException("The archive was closed.", "AbortError");
		assertNotAborted(this.controller.signal);
	}
}

export class DuplicateArchivePathError extends Error {
	constructor() {
		super("This archive contains conflicting file occurrences. Open the inventory to inspect their sources.");
		this.name = "DuplicateArchivePathError";
	}
}

export async function createArchiveSession(
	files: File[],
	onProgress?: ArchiveProgressCallback,
	options?: BuildIndexOptions,
): Promise<ArchiveSession> {
	if (!files.length) {
		throw new Error("No archive files selected");
	}

	onProgress?.(
		5,
		files.length === 1 ? `Indexing ${files[0].name}` : "Indexing zip files",
	);
	const sources: SnapZipSource[] = files.map((file, index) => ({
		id: `source-${index}`,
		file,
	}));
	const index = await buildSnapZipIndex(sources, { ...options, onProgress(completed, total, entries) {
		onProgress?.(Math.round(completed / total * 60), `Indexed ${completed} of ${total} ZIP parts`);
		options?.onProgress?.(completed, total, entries);
	} });
	assertNotAborted(options?.signal);

	onProgress?.(65, "Reading account metadata");
	const reader = new SnapchatArchiveReader(index);
	const abort = () => reader.dispose();
	options?.signal?.addEventListener("abort", abort, { once: true });
	try {
	const account = parseAccountJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.account).catch((error: unknown) => {
		if (error instanceof DuplicateArchivePathError) return null;
		throw error;
	}));

	onProgress?.(75, "Reading friends list");
	const friends = parseFriendsJson(
		await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.friends).catch((error: unknown) => {
			if (error instanceof DuplicateArchivePathError) return null;
			throw error;
		}),
	);
	const capabilities = buildArchiveCapabilities(index);
	const diagnostics = buildArchiveDiagnostics(index);

	const metadata: ArchiveMetadata = {
		account,
		friends,
		capabilities,
		diagnostics,
		stats: {
			friendCount: friends.length,
			hasChatHistory: capabilities.hasChatHistoryJson,
			hasSnapHistory: capabilities.hasSnapHistoryJson,
			hasMemoriesHistory: capabilities.hasMemoriesHistoryJson,
			hasStoryHistory: capabilities.hasStoryHistoryJson,
		},
	};

	onProgress?.(90, "Preparing archive session");

	return {
		index,
		reader,
		metadata,
	};
	} catch (error) {
		reader.dispose();
		throw error;
	} finally {
		options?.signal?.removeEventListener("abort", abort);
	}
}

function buildArchiveCapabilities(index: SnapZipIndex): ArchiveCapabilities {
	return {
		hasAccountJson: hasPath(index, SNAP_JSON_PATHS.account),
		hasFriendsJson: hasPath(index, SNAP_JSON_PATHS.friends),
		hasChatHistoryJson: hasPath(index, SNAP_JSON_PATHS.chatHistory),
		hasSnapHistoryJson: hasPath(index, SNAP_JSON_PATHS.snapHistory),
		hasStoryHistoryJson: hasPath(index, SNAP_JSON_PATHS.storyHistory),
		hasMemoriesHistoryJson: hasPath(index, SNAP_JSON_PATHS.memoriesHistory),
		hasMemoriesDirectory: hasPrefix(index, "memories/"),
		hasChatMediaDirectory: hasPrefix(index, "chat_media/"),
	};
}

function buildArchiveDiagnostics(index: SnapZipIndex): ArchiveDiagnostics {
	const jsonFiles = index.entries
		.filter(
			(entry) =>
				!entry.isDirectory &&
				entry.id.path.startsWith("json/") &&
				entry.id.path.endsWith(".json"),
		)
		.map((entry) => entry.id.path)
		.sort();

	const expectedPaths = new Set<string>(EXPECTED_SNAPCHAT_JSON_PATHS);
	const mediaEntries = index.entries.filter(
		(entry) => !entry.isDirectory && isMediaPath(entry.id.path),
	);

	return {
		missingExpectedPaths: EXPECTED_SNAPCHAT_JSON_PATHS.filter(
			(path) => !hasPath(index, path),
		),
		unknownJsonFiles: jsonFiles.filter((path) => !expectedPaths.has(path)),
		mediaCountsByDirectory: countBy(
			mediaEntries.map((entry) => entry.id.path.split("/")[0] ?? ""),
		),
		mediaCountsByExtension: countBy(
			mediaEntries.map((entry) => extensionForPath(entry.id.path)),
		),
		duplicateEntryPaths: findDuplicateSnapZipPaths(index),
	};
}

async function normalizeContentToArrayBuffer(
	content: ArrayBuffer | ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
	if (content instanceof ArrayBuffer) {
		return content;
	}

	const response = new Response(content);
	return response.arrayBuffer();
}

function hasPath(index: SnapZipIndex, path: string): boolean {
	return Boolean(findSnapZipEntryByPath(index, path));
}

function hasPrefix(index: SnapZipIndex, prefix: string): boolean {
	return findSnapZipEntriesByPrefix(index, prefix).some(
		(entry) => !entry.isDirectory,
	);
}

function isMediaPath(path: string): boolean {
	return path.startsWith("memories/") || path.startsWith("chat_media/");
}

function extensionForPath(path: string): string {
	const match = /\.([^.]+)$/.exec(path);
	return match?.[1]?.toLowerCase() ?? "unknown";
}

function mimeTypeForPath(path: string): string {
	const extension = extensionForPath(path);
	if (extension === "mp4") return "video/mp4";
	if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
	if (extension === "png") return "image/png";
	return "application/octet-stream";
}

function countBy(values: string[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const value of values) {
		counts[value] = (counts[value] ?? 0) + 1;
	}
	return counts;
}
