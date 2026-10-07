import {
	BlobReader,
	BlobWriter,
	ZipReader,
	type Entry,
	type WorkerConfiguration,
} from "@zip.js/zip.js";

export type SnapZipSourceId = string;

export interface SnapZipSource {
	id: SnapZipSourceId;
	file: File | Blob;
}

export interface SnapZipEntryId {
	sourceId: SnapZipSourceId;
	path: string;
}

export interface SnapZipEntryMeta {
	id: SnapZipEntryId;
	compressedSize: number;
	uncompressedSize: number;
	isDirectory: boolean;
}

export interface SnapZipIndex {
	sources: SnapZipSource[];
	entries: SnapZipEntryMeta[];
}

export interface BuildIndexOptions {
	entryFilter?: (meta: SnapZipEntryMeta) => boolean;
}

export interface ReadEntryOptions {
	asStream?: boolean;
}

export type SnapZipEntryContent = ArrayBuffer | ReadableStream<Uint8Array>;

export class ZipSourceNotFoundError extends Error {
	readonly sourceId: SnapZipSourceId;

	constructor(sourceId: SnapZipSourceId) {
		super(`Archive ZIP source not found: ${sourceId}`);
		this.name = "ZipSourceNotFoundError";
		this.sourceId = sourceId;
	}
}

export class SnapZipEntryNotFoundError extends Error {
	readonly entryId: SnapZipEntryId;

	constructor(entryId: SnapZipEntryId) {
		super(`Archive ZIP entry not found: ${entryId.sourceId}/${entryId.path}`);
		this.name = "SnapZipEntryNotFoundError";
		this.entryId = entryId;
	}
}

export class SnapZipEntryIsDirectoryError extends Error {
	readonly entryId: SnapZipEntryId;

	constructor(entryId: SnapZipEntryId) {
		super(
			`Archive ZIP entry is a directory: ${entryId.sourceId}/${entryId.path}`,
		);
		this.name = "SnapZipEntryIsDirectoryError";
		this.entryId = entryId;
	}
}

interface SnapZipIndexInternals {
	sourceMap: Map<SnapZipSourceId, SnapZipSource>;
	entryMap: Map<string, SnapZipEntryMeta>;
}

const SNAP_INDEX_INTERNALS = new WeakMap<SnapZipIndex, SnapZipIndexInternals>();

const DEFAULT_WORKER_OPTIONS: WorkerConfiguration = {
	useWebWorkers: typeof Worker !== "undefined",
};

export async function buildSnapZipIndex(
	sources: SnapZipSource[],
	options?: BuildIndexOptions,
): Promise<SnapZipIndex> {
	const normalizedSources = sources.map((source) => ({ ...source }));
	const sourceMap = new Map<SnapZipSourceId, SnapZipSource>();
	const entryMap = new Map<string, SnapZipEntryMeta>();
	const entries: SnapZipEntryMeta[] = [];

	for (const source of normalizedSources) {
		sourceMap.set(source.id, source);
		const reader = new ZipReader(
			new BlobReader(source.file),
			DEFAULT_WORKER_OPTIONS,
		);
		try {
			const zipEntries = await reader.getEntries();
			for (const entry of zipEntries) {
				const meta = toSnapEntryMeta(entry, source.id);
				if (options?.entryFilter && !options.entryFilter(meta)) continue;
				entries.push(meta);
				entryMap.set(getEntryKey(meta.id), meta);
			}
		} finally {
			await safeClose(reader);
		}
	}

	const index: SnapZipIndex = {
		sources: normalizedSources,
		entries,
	};

	SNAP_INDEX_INTERNALS.set(index, { sourceMap, entryMap });
	return index;
}

export async function readSnapZipEntryContent(
	index: SnapZipIndex,
	entryId: SnapZipEntryId,
	options?: ReadEntryOptions,
): Promise<SnapZipEntryContent> {
	const internals = ensureInternals(index);
	if (!internals.entryMap.has(getEntryKey(entryId))) {
		throw new SnapZipEntryNotFoundError(entryId);
	}
	const source = internals.sourceMap.get(entryId.sourceId);

	if (!source) {
		throw new ZipSourceNotFoundError(entryId.sourceId);
	}

	const reader = new ZipReader(
		new BlobReader(source.file),
		DEFAULT_WORKER_OPTIONS,
	);
	try {
		const zipEntries = await reader.getEntries();
		const target = zipEntries.find((entry) => entry.filename === entryId.path);
		if (!target) {
			throw new SnapZipEntryNotFoundError(entryId);
		}
		if (target.directory) {
			throw new SnapZipEntryIsDirectoryError(entryId);
		}

		if (options?.asStream) {
			const blobWriter = new BlobWriter("application/octet-stream");
			const blob = (await target.getData(
				blobWriter,
				DEFAULT_WORKER_OPTIONS,
			)) as Blob;
			return typeof blob.stream === "function"
				? blob.stream()
				: blob.arrayBuffer();
		}

		return target.arrayBuffer(DEFAULT_WORKER_OPTIONS);
	} finally {
		await safeClose(reader);
	}
}

export function findSnapZipEntryByPath(
	index: SnapZipIndex,
	path: string,
): SnapZipEntryMeta | undefined {
	return index.entries.find((entry) => entry.id.path === path);
}

export function findSnapZipEntriesByPrefix(
	index: SnapZipIndex,
	prefix: string,
): SnapZipEntryMeta[] {
	return index.entries.filter((entry) => entry.id.path.startsWith(prefix));
}

export function findDuplicateSnapZipPaths(index: SnapZipIndex): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const entry of index.entries) {
		if (seen.has(entry.id.path)) {
			duplicates.add(entry.id.path);
		}
		seen.add(entry.id.path);
	}

	return Array.from(duplicates).sort();
}

function getEntryKey(entryId: SnapZipEntryId): string {
	return `${entryId.sourceId}::${entryId.path}`;
}

function ensureInternals(index: SnapZipIndex): SnapZipIndexInternals {
	let internals = SNAP_INDEX_INTERNALS.get(index);
	if (internals) {
		return internals;
	}

	const sourceMap = new Map<SnapZipSourceId, SnapZipSource>();
	for (const source of index.sources) {
		sourceMap.set(source.id, source);
	}

	const entryMap = new Map<string, SnapZipEntryMeta>();
	for (const entry of index.entries) {
		entryMap.set(getEntryKey(entry.id), entry);
	}

	internals = { sourceMap, entryMap };
	SNAP_INDEX_INTERNALS.set(index, internals);
	return internals;
}

function toSnapEntryMeta(
	entry: Entry,
	sourceId: SnapZipSourceId,
): SnapZipEntryMeta {
	return {
		id: { sourceId, path: entry.filename },
		compressedSize: entry.compressedSize,
		uncompressedSize: entry.uncompressedSize,
		isDirectory: entry.directory === true,
	};
}

async function safeClose(reader: ZipReader<unknown>): Promise<void> {
	try {
		await reader.close();
	} catch {}
}