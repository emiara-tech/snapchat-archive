import {
	BlobReader,
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
	/** Distinguishes repeated entry names within one ZIP. */
	ordinal?: number;
}

export interface SnapZipEntryMeta {
	id: SnapZipEntryId;
	compressedSize: number;
	uncompressedSize: number;
	isDirectory: boolean;
	signature?: number;
}

export interface SnapZipIndex {
	sources: SnapZipSource[];
	entries: SnapZipEntryMeta[];
}

export interface BuildIndexOptions {
	entryFilter?: (meta: SnapZipEntryMeta) => boolean;
	signal?: AbortSignal;
	limits?: Partial<ArchiveResourceLimits>;
	onProgress?: (completedSources: number, totalSources: number, entries: number) => void;
}

export interface ReadEntryOptions {
	asStream?: boolean;
	signal?: AbortSignal;
	maxBytes?: number;
}

export interface ArchiveResourceLimits {
	maxEntries: number;
	maxEntryBytes: number;
	maxTotalBytes: number;
	maxExpansionRatio: number;
	maxReadBytes: number;
}

export const DEFAULT_ARCHIVE_RESOURCE_LIMITS: ArchiveResourceLimits = {
	maxEntries: 500_000,
	maxEntryBytes: 1024 * 1024 * 1024,
	maxTotalBytes: 64 * 1024 * 1024 * 1024,
	maxExpansionRatio: 1000,
	maxReadBytes: 512 * 1024 * 1024,
};

export class ArchiveResourceLimitError extends Error {
	readonly code = "archive_resource_limit";
	readonly limit: keyof ArchiveResourceLimits;
	constructor(limit: keyof ArchiveResourceLimits) {
		super(`This archive exceeds the ${limit} safety limit. Try a smaller export or date range.`);
		this.name = "ArchiveResourceLimitError";
		this.limit = limit;
	}
}

export function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DOMException("The archive operation was canceled.", "AbortError");
}

export function isSafeArchivePath(path: string): boolean {
	return Boolean(path) && !path.startsWith("/") && !path.includes("\\")
		&& !path.includes(":") && !path.includes("\0")
		&& !path.split("/").some((part) => part === ".." || part === ".");
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
	limits: ArchiveResourceLimits;
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
	const limits = { ...DEFAULT_ARCHIVE_RESOURCE_LIMITS, ...options?.limits };
	for (const value of Object.values(limits)) {
		if (!Number.isFinite(value) || value <= 0) throw new Error("Archive safety limits must be finite positive numbers.");
	}
	const sourceMap = new Map<SnapZipSourceId, SnapZipSource>();
	const entryMap = new Map<string, SnapZipEntryMeta>();
	const entries: SnapZipEntryMeta[] = [];
	let totalBytes = 0;
	let totalEntries = 0;

	for (const source of normalizedSources) {
		assertNotAborted(options?.signal);
		if (sourceMap.has(source.id)) throw new Error("Archive ZIP source identities must be unique.");
		sourceMap.set(source.id, source);
		const reader = new ZipReader(
			new BlobReader(source.file),
			DEFAULT_WORKER_OPTIONS,
		);
		try {
			const zipEntries = await reader.getEntries();
			for (const [ordinal, entry] of zipEntries.entries()) {
				assertNotAborted(options?.signal);
				if (!isSafeArchivePath(entry.filename)) throw new Error("This archive contains an unsafe file path.");
				const meta = toSnapEntryMeta(entry, source.id, ordinal);
				totalEntries += 1;
				if (totalEntries > limits.maxEntries) throw new ArchiveResourceLimitError("maxEntries");
				if (!Number.isSafeInteger(meta.uncompressedSize) || meta.uncompressedSize < 0
					|| !Number.isSafeInteger(meta.compressedSize) || meta.compressedSize < 0) {
					throw new Error("This archive contains invalid file sizes.");
				}
				if (meta.uncompressedSize > limits.maxEntryBytes) throw new ArchiveResourceLimitError("maxEntryBytes");
				totalBytes += meta.uncompressedSize;
				if (totalBytes > limits.maxTotalBytes) throw new ArchiveResourceLimitError("maxTotalBytes");
				if (meta.uncompressedSize / Math.max(meta.compressedSize, 1) > limits.maxExpansionRatio) {
					throw new ArchiveResourceLimitError("maxExpansionRatio");
				}
				if (options?.entryFilter && !options.entryFilter(meta)) continue;
				entries.push(meta);
				entryMap.set(getEntryKey(meta.id), meta);
			}
		} finally {
			await safeClose(reader);
		}
		options?.onProgress?.(sourceMap.size, normalizedSources.length, totalEntries);
	}

	const index: SnapZipIndex = {
		sources: normalizedSources,
		entries,
	};

	SNAP_INDEX_INTERNALS.set(index, { sourceMap, entryMap, limits });
	return index;
}

export async function readSnapZipEntryContent(
	index: SnapZipIndex,
	entryId: SnapZipEntryId,
	options?: ReadEntryOptions,
): Promise<SnapZipEntryContent> {
	const internals = ensureInternals(index);
	assertNotAborted(options?.signal);
	const matches = index.entries.filter((entry) => entry.id.sourceId === entryId.sourceId
		&& entry.id.path === entryId.path && (entryId.ordinal === undefined || entry.id.ordinal === entryId.ordinal));
	if (!matches.length) {
		throw new SnapZipEntryNotFoundError(entryId);
	}
	if (matches.length !== 1) throw new Error("This archive path has multiple occurrences. Select an exact source occurrence.");
	const meta = matches[0]!;
	const maxBytes = Math.min(options?.maxBytes ?? internals.limits.maxReadBytes, internals.limits.maxReadBytes);
	if (meta.uncompressedSize > maxBytes) throw new ArchiveResourceLimitError("maxReadBytes");
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
		assertNotAborted(options?.signal);
		const target = meta.id.ordinal === undefined
			? zipEntries.find((entry) => entry.filename === entryId.path)
			: zipEntries[meta.id.ordinal];
		if (!target) {
			throw new SnapZipEntryNotFoundError(entryId);
		}
		if (target.directory) {
			throw new SnapZipEntryIsDirectoryError(entryId);
		}

		const chunks: Uint8Array<ArrayBuffer>[] = [];
		let actualBytes = 0;
		let limitFailure: ArchiveResourceLimitError | null = null;
		try {
		await target.getData(new WritableStream<Uint8Array>({
			write(chunk) {
				assertNotAborted(options?.signal);
				actualBytes += chunk.byteLength;
				if (actualBytes > maxBytes) {
					limitFailure = new ArchiveResourceLimitError("maxReadBytes");
					throw limitFailure;
				}
				chunks.push(new Uint8Array(chunk));
			},
		}), { ...DEFAULT_WORKER_OPTIONS, signal: options?.signal, checkSignature: true });
		} catch (error) {
			if (limitFailure) throw limitFailure;
			assertNotAborted(options?.signal);
			throw error;
		}
		assertNotAborted(options?.signal);
		const blob = new Blob(chunks, { type: "application/octet-stream" });
		return options?.asStream ? blob.stream() : blob.arrayBuffer();
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
	return `${entryId.sourceId}::${entryId.path}::${entryId.ordinal ?? "first"}`;
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

	internals = { sourceMap, entryMap, limits: DEFAULT_ARCHIVE_RESOURCE_LIMITS };
	SNAP_INDEX_INTERNALS.set(index, internals);
	return internals;
}

function toSnapEntryMeta(
	entry: Entry,
	sourceId: SnapZipSourceId,
	ordinal: number,
): SnapZipEntryMeta {
	return {
		id: { sourceId, path: entry.filename, ordinal },
		compressedSize: entry.compressedSize,
		uncompressedSize: entry.uncompressedSize,
		isDirectory: entry.directory === true,
		signature: entry.signature,
	};
}

async function safeClose(reader: ZipReader<unknown>): Promise<void> {
	try {
		await reader.close();
	} catch {}
}
