import type {
	Account,
	ChatHistory,
	Friend,
	MediaRecord,
	SavedMediaJson,
	SnapHistory,
	StoryHistoryJson,
} from "../types";

export function parseAccountJson(value: unknown): Account | null {
	if (!isRecord(value) || !isRecord(value["Basic Information"])) return null;
	return value as unknown as Account;
}

export function parseFriendsJson(value: unknown): Friend[] {
	if (!isRecord(value) || !Array.isArray(value.Friends)) return [];
	return value.Friends.filter(isFriend);
}

export function parseChatHistoryJson(value: unknown): ChatHistory {
	if (!isRecord(value)) return {};
	return filterThreadRecord(value) as ChatHistory;
}

export function parseSnapHistoryJson(value: unknown): SnapHistory {
	if (!isRecord(value)) return {};
	return filterThreadRecord(value) as SnapHistory;
}

export function parseStoryHistoryJson(value: unknown): StoryHistoryJson | null {
	if (!isRecord(value)) return null;
	return {
		"Your Story Views": Array.isArray(value["Your Story Views"])
			? value["Your Story Views"]
			: [],
		"Friend and Public Story Views": Array.isArray(
			value["Friend and Public Story Views"],
		)
			? value["Friend and Public Story Views"]
			: undefined,
	} as StoryHistoryJson;
}

/**
 * Parses `memories_history.json` into records the app can render offline.
 *
 * Each raw entry carries a `Download Link` pointing at Snapchat's CDN. That URL
 * is never kept: it expires roughly a week after the export is generated, and
 * requesting it would report to Snap exactly which memories are being opened.
 * It is read only to recover the media id (`mid`) that names the file inside the
 * export's own `memories/` directory, and is discarded from there on.
 */
export function parseMemoriesHistoryJson(value: unknown): MediaRecord[] {
	if (!isRecord(value) || !Array.isArray(value["Saved Media"])) return [];

	return (value as unknown as SavedMediaJson)["Saved Media"]
		.map(normalizeMediaRecord)
		.filter((memory): memory is MediaRecord => memory !== null);
}

function normalizeMediaRecord(value: unknown): MediaRecord | null {
	if (!isRecord(value)) return null;
	const date = readString(value.Date);
	const mediaType = readString(value["Media Type"]);
	const mainFilePath = mediaType
		? deriveArchiveMediaPath(value, mediaType, "main")
		: null;
	const overlayFilePath = mediaType
		? deriveArchiveMediaPath(value, mediaType, "overlay")
		: null;

	if (!date || !mediaType || !mainFilePath) return null;

	return {
		date,
		mediaType,
		location: readString(value.Location),
		mainFilePath: mainFilePath,
		overlayFilePath: overlayFilePath,
	};
}

function filterThreadRecord(
	value: Record<string, unknown>,
): Record<string, unknown[]> {
	const result: Record<string, unknown[]> = {};
	for (const [key, thread] of Object.entries(value)) {
		if (Array.isArray(thread)) {
			result[key] = thread.filter(isRecord);
		}
	}
	return result;
}

function isFriend(value: unknown): value is Friend {
	return (
		isRecord(value) &&
		typeof value.Username === "string" &&
		typeof value["Display Name"] === "string"
	);
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Path inside the export that every archive media path must live under. */
const MEMORIES_DIRECTORY = "memories/";

/**
 * Turns a raw memory entry into a path inside the export's `memories/`
 * directory. The remote `Download Link` is consumed here and never returned:
 * only its `mid` query parameter escapes this function, as part of the local
 * filename. A record whose link cannot yield a `mid` is dropped rather than
 * falling back to the remote URL.
 */
function deriveArchiveMediaPath(
	value: Record<string, unknown>,
	mediaType: string,
	type: string,
): string | null {
	const date = readString(value.Date);
	const downloadLink = readString(value["Download Link"]);
	if (!date || !downloadLink) {
		// Never log the link or the raw record: both identify the memory.
		console.warn("[archive] memory record missing Date or Download Link", {
			hasDate: date !== null,
			hasDownloadLink: downloadLink !== null,
		});
		return null;
	}

	const dateFormatted = date.slice(0, 10);
	try {
		const url = new URL(downloadLink);
		const mid = url.searchParams.get("mid");
		if (!mid) {
			console.warn(
				'[archive] memory record Download Link has no "mid" param; skipping',
			);
			return null;
		}
		const extension =
			type === "overlay"
				? "png"
				: mediaType.toLowerCase() === "video"
					? "mp4"
					: "jpg";
		const path = `${MEMORIES_DIRECTORY}${dateFormatted}_${mid}-${type}.${extension}`;
		// Guard against a malformed `mid` (e.g. a nested URL) smuggling a remote
		// reference into a field the app treats as a local archive path.
		if (!isArchiveMediaPath(path)) {
			console.warn(
				"[archive] memory record produced a non-archive path; skipping",
			);
			return null;
		}
		return path;
	} catch {
		console.warn(
			"[archive] memory record Download Link is not a valid URL; skipping",
		);
		return null;
	}
}

/**
 * True only for a relative path under `memories/` with no scheme, authority, or
 * parent-directory traversal — i.e. something `ArchiveReader` can look up in the
 * user's own zip.
 */
function isArchiveMediaPath(path: string): boolean {
	if (!path.startsWith(MEMORIES_DIRECTORY)) return false;
	if (path.includes("://") || path.includes("//")) return false;
	if (path.includes(":")) return false;
	return !path.split("/").includes("..");
}
