import type {
	Account,
	ChatHistory,
	Friend,
	MediaRecord,
	SavedMediaJson,
	SnapHistory,
	StoryHistoryJson,
} from '../types'

export function parseAccountJson(value: unknown): Account | null {
	if (!isRecord(value) || !isRecord(value['Basic Information'])) return null
	return value as unknown as Account
}

export function parseFriendsJson(value: unknown): Friend[] {
	if (!isRecord(value) || !Array.isArray(value.Friends)) return []
	return value.Friends.filter(isFriend)
}

export function parseChatHistoryJson(value: unknown): ChatHistory {
	if (!isRecord(value)) return {}
	return filterThreadRecord(value) as ChatHistory
}

export function parseSnapHistoryJson(value: unknown): SnapHistory {
	if (!isRecord(value)) return {}
	return filterThreadRecord(value) as SnapHistory
}

export function parseStoryHistoryJson(value: unknown): StoryHistoryJson | null {
	if (!isRecord(value)) return null
	return {
		'Your Story Views': Array.isArray(value['Your Story Views']) ? value['Your Story Views'] : [],
		'Friend and Public Story Views': Array.isArray(value['Friend and Public Story Views'])
			? value['Friend and Public Story Views']
			: undefined,
	} as StoryHistoryJson
}

/** Parses json of the memories
 *
 */
export function parseMemoriesHistoryJson(value: unknown): MediaRecord[] {
	if (!isRecord(value) || !Array.isArray(value['Saved Media'])) return []

	return (value as unknown as SavedMediaJson)['Saved Media']
		.map(normalizeMediaRecord)
		.filter((memory): memory is MediaRecord => memory !== null)
}

function normalizeMediaRecord(value: unknown): MediaRecord | null {
	if (!isRecord(value)) return null
	const date = readString(value.Date)
	const mediaType = readString(value['Media Type'])
	const mainFilePath = mediaType ? constructFilePath(value, mediaType, "main") : null
	const overlayFilePath = mediaType ? constructFilePath(value, mediaType, "overlay") : null

	if (!date || !mediaType || !mainFilePath) return null

	return {
		date,
		mediaType,
		location: readString(value.Location),
		mainFilePath: mainFilePath,
		overlayFilePath: overlayFilePath
	}
}

function filterThreadRecord(value: Record<string, unknown>): Record<string, unknown[]> {
	const result: Record<string, unknown[]> = {}
	for (const [key, thread] of Object.entries(value)) {
		if (Array.isArray(thread)) {
			result[key] = thread.filter(isRecord)
		}
	}
	return result
}

function isFriend(value: unknown): value is Friend {
	return (
		isRecord(value) &&
		typeof value.Username === 'string' &&
		typeof value['Display Name'] === 'string'
	)
}

function readString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function constructFilePath(value: Record<string, unknown>, mediaType: string, type: string): string | null {
	const date = readString(value.Date)
	const downloadLink = readString(value['Download Link'])
	if (!date || !downloadLink) {
		console.warn('[archive] memory record missing required fields', { date, downloadLink, record: value })
		return null
	}

	const dateFormatted = date.slice(0, 10)
	try {
		const url = new URL(downloadLink)
		const mid = url.searchParams.get('mid')
		if (!mid) {
			console.warn('[archive] memory record Download Link has no "mid" param', { downloadLink, record: value })
			return null
		}
		const extension = type === 'overlay' ? 'png' : (mediaType.toLowerCase() === 'video' ? 'mp4' : 'jpg')
		return `memories/${dateFormatted}_${mid}-${type}.${extension}`
	} catch {
		console.warn('[archive] memory record Download Link is not a valid URL', { downloadLink, record: value })
		return null
	}
}
