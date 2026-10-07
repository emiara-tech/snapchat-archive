export interface Friend {
	Username: string;
	"Display Name": string;
	"Creation Timestamp": string;
	"Last Modified Timestamp": string;
	Source: string;
}

export interface FriendsJson {
	Friends: Friend[];
}

export interface ChatMessage {
	From: string;
	"Media Type":
		| "TEXT"
		| "IMAGE"
		| "VIDEO"
		| "STICKER"
		| "AUDIO"
		| "GIF"
		| "ATTACHMENT";
	Created: string;
	Content: string | null;
	"Conversation Title": string | null;
	IsSender: boolean;
	"Created(microseconds)": number;
	IsSaved: boolean;
	"Media IDs": string;
}

export type ChatThread = ChatMessage[];

export type ChatHistory = Record<string, ChatThread>;

export interface SnapEntry {
	From: string;
	"Media Type": "IMAGE" | "VIDEO" | "UNKNOWN";
	Created: string;
	"Conversation Title": string | null;
	IsSender: boolean;
	"Created(microseconds)": number;
}

export type SnapHistory = Record<string, SnapEntry[]>;

/**
 * A memory as the app holds it. Deliberately has no `Download Link`: Snapchat's
 * CDN URLs expire about a week after the export is generated, and fetching them
 * would tell Snap which memories are being opened and when. Media is read from
 * the `memories/` directory inside the user's own export instead.
 */
export interface MediaRecord {
	date: string;
	mediaType: "Image" | "Video" | string;
	location: string | null;
	/** Path inside the archive zip, e.g. `memories/2026-03-21_<mid>-main.jpg`. */
	mainFilePath: string;
	overlayFilePath: string | null;
}

/** Raw `memories_history.json` shape, before the remote link is discarded. */
export interface SavedMediaJson {
	"Saved Media": RawSavedMediaEntry[];
}

export interface RawSavedMediaEntry {
	Date?: unknown;
	"Media Type"?: unknown;
	Location?: unknown;
	/** Expiring Snap CDN URL. Read for its `mid` only, never stored or fetched. */
	"Download Link"?: unknown;
	[key: string]: unknown;
}

export interface Story {
	"Story Date": string;
	"Story Views": number;
	"Story Replies": number;
}

export interface StoryHistoryJson {
	"Your Story Views": Story[];
	"Friend and Public Story Views"?: Story[];
}

export interface DeviceRecord {
	Make: string;
	Model?: string;
	"Start Time": string;
	"Device Type": string;
}

export interface Account {
	"Basic Information": {
		Username: string;
		Name?: string;
		"Creation Date"?: string;
		"Last Active"?: string;
	};
	"Device History"?: DeviceRecord[];
}

export interface ArchiveMetadata {
	account: Account | null;
	friends: Friend[];
	capabilities: ArchiveCapabilities;
	diagnostics: ArchiveDiagnostics;
	stats: {
		friendCount: number;
		hasChatHistory: boolean;
		hasSnapHistory: boolean;
		hasMemoriesHistory: boolean;
		hasStoryHistory: boolean;
	};
}

export interface ArchiveCapabilities {
	hasAccountJson: boolean;
	hasFriendsJson: boolean;
	hasChatHistoryJson: boolean;
	hasSnapHistoryJson: boolean;
	hasStoryHistoryJson: boolean;
	hasMemoriesHistoryJson: boolean;
	hasMemoriesDirectory: boolean;
	hasChatMediaDirectory: boolean;
}

export interface ArchiveDiagnostics {
	missingExpectedPaths: string[];
	unknownJsonFiles: string[];
	mediaCountsByDirectory: Record<string, number>;
	mediaCountsByExtension: Record<string, number>;
	duplicateEntryPaths: string[];
}

export interface TopFriendEntry {
	username: string;
	displayName: string;
	totalMessages: number;
	sentMessages: number;
	receivedMessages: number;
}

export interface ComputedArchiveStats {
	totalSnaps: number;
	totalChats: number;
	totalStories: number;
	totalMemories: number;
	totalFriends: number;
	longestChatActiveRunDays: number;
	dateRange: {
		start: string;
		end: string;
	};
	totalDays: number;
	topFriends: TopFriendEntry[];
	totalIndexedMediaSize: string;
}

export interface ExportConfig {
	includeSnaps: boolean;
	includeChats: boolean;
	includeStories: boolean;
	includeMetadata: boolean;
	format: "json";
	dateRange?: {
		start: string;
		end: string;
	};
}