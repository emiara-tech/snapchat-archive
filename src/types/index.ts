export interface Friend {
  Username: string
  "Display Name": string
  "Creation Timestamp": string
  "Last Modified Timestamp": string
  Source: string
}

export interface FriendsJson {
  Friends: Friend[]
}

export interface ChatMessage {
  From: string
  "Media Type": 'TEXT' | 'IMAGE' | 'VIDEO' | 'STICKER' | 'AUDIO' | 'GIF' | 'ATTACHMENT'
  Created: string
  Content: string | null
  "Conversation Title": string | null
  IsSender: boolean
  "Created(microseconds)": number
  IsSaved: boolean
  "Media IDs": string
}

export type ChatThread = ChatMessage[]

export type ChatHistory = Record<string, ChatThread>

export interface SnapEntry {
  From: string
  "Media Type": 'IMAGE' | 'VIDEO' | 'UNKNOWN'
  Created: string
  "Conversation Title": string | null
  IsSender: boolean
  "Created(microseconds)": number
}

export type SnapHistory = Record<string, SnapEntry[]>

export interface Photo {
  date: string
  mediaType: 'Image' | 'Video' | string
  location: string | null
  downloadLink: string | null
  mediaDownloadUrl: string | null
}

export interface PhotosJson {
  "Saved Media": Photo[]
}

export type MemoryRecord = Photo
export type MemoriesHistoryJson = PhotosJson

export interface Story {
  "Story Date": string
  "Story Views": number
  "Story Replies": number
}

export interface StoryHistoryJson {
  "Your Story Views": Story[]
  "Friend and Public Story Views"?: Story[]
}

export interface DeviceRecord {
  Make: string
  Model?: string
  "Start Time": string
  "Device Type": string
}

export interface Account {
  "Basic Information": {
    Username: string
    Name?: string
    "Creation Date"?: string
    "Last Active"?: string
  }
  "Device History"?: DeviceRecord[]
}

export interface ArchiveMetadata {
  account: Account | null
  friends: Friend[]
  capabilities: ArchiveCapabilities
  diagnostics: ArchiveDiagnostics
  stats: {
    friendCount: number
    hasChatHistory: boolean
    hasSnapHistory: boolean
    hasMemoriesHistory: boolean
    hasStoryHistory: boolean
  }
}

export interface ArchiveCapabilities {
  hasAccountJson: boolean
  hasFriendsJson: boolean
  hasChatHistoryJson: boolean
  hasSnapHistoryJson: boolean
  hasStoryHistoryJson: boolean
  hasMemoriesHistoryJson: boolean
  hasMemoriesDirectory: boolean
  hasChatMediaDirectory: boolean
}

export interface ArchiveDiagnostics {
  missingExpectedPaths: string[]
  unknownJsonFiles: string[]
  mediaCountsByDirectory: Record<string, number>
  mediaCountsByExtension: Record<string, number>
  duplicateEntryPaths: string[]
}

export interface TopFriendEntry {
  username: string
  displayName: string
  totalMessages: number
  sentMessages: number
  receivedMessages: number
}

export interface ComputedArchiveStats {
  totalSnaps: number
  totalChats: number
  totalStories: number
  totalMemories: number
  totalFriends: number
  longestChatActiveRunDays: number
  dateRange: {
    start: string
    end: string
  }
  totalDays: number
  topFriends: TopFriendEntry[]
  totalIndexedMediaSize: string
}

// Legacy alias kept to avoid breaking imports during migration
export type ArchiveStats = ComputedArchiveStats

export interface ExportConfig {
  includeSnaps: boolean
  includeChats: boolean
  includeStories: boolean
  includeMetadata: boolean
  format: 'json'
  dateRange?: {
    start: string
    end: string
  }
}

export type { Friend as SnapchatFriendRecord }
export type { ChatMessage as SnapchatChatMessageRecord }
export type { SnapEntry as SnapchatSnapHistoryEntry }
export type { Photo as SnapchatPhotoRecord }
export type { Story as SnapchatStoryHistoryRecord }
export type { Account as SnapchatAccountJson }
