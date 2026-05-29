import {
  buildSnapZipIndex,
  findDuplicateSnapZipPaths,
  findSnapZipEntriesByPrefix,
  findSnapZipEntryByPath,
  readSnapZipEntryContent,
  type SnapZipIndex,
  type SnapZipSource,
} from './snapZip'
import {
  type ArchiveCapabilities,
  type ArchiveDiagnostics,
  type ArchiveMetadata,
} from '../types'
import { EXPECTED_SNAPCHAT_JSON_PATHS, SNAPCHAT_JSON_PATHS } from './snapchatArchivePaths'
import { parseAccountJson, parseFriendsJson } from './snapchatParsers'

export interface ArchiveSession {
  index: SnapZipIndex
  reader: SnapchatArchiveReader
  metadata: ArchiveMetadata
}

export type ArchiveProgressCallback = (progress: number, status: string) => void

export const SNAP_JSON_PATHS = SNAPCHAT_JSON_PATHS

export class SnapchatArchiveReader {
  readonly index: SnapZipIndex

  constructor(index: SnapZipIndex) {
    this.index = index
  }

  async readJsonFile<T>(path: string): Promise<T | null> {
    const entry = findSnapZipEntryByPath(this.index, path)
    if (!entry) return null
    const content = await readSnapZipEntryContent(this.index, entry.id)
    const buffer = await normalizeContentToArrayBuffer(content)
    const text = new TextDecoder('utf-8').decode(buffer)
    return JSON.parse(text) as T
  }
}

export async function createArchiveSession(
  files: File[],
  onProgress?: ArchiveProgressCallback,
): Promise<ArchiveSession> {
  if (!files.length) {
    throw new Error('No archive files selected')
  }

  onProgress?.(5, files.length === 1 ? `Indexing ${files[0].name}` : 'Indexing zip files')
  const sources: SnapZipSource[] = files.map((file, index) => ({ id: `source-${index}`, file }))
  const index = await buildSnapZipIndex(sources)

  onProgress?.(30, 'Reading account metadata')
  const reader = new SnapchatArchiveReader(index)
  const account = parseAccountJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.account))

  onProgress?.(55, 'Reading friends list')
  const friends = parseFriendsJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.friends))
  const capabilities = buildArchiveCapabilities(index)
  const diagnostics = buildArchiveDiagnostics(index)

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
  }

  onProgress?.(80, 'Preparing archive session')

  return {
    index,
    reader,
    metadata,
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
    hasMemoriesDirectory: hasPrefix(index, 'memories/'),
    hasChatMediaDirectory: hasPrefix(index, 'chat_media/'),
  }
}

function buildArchiveDiagnostics(index: SnapZipIndex): ArchiveDiagnostics {
  const jsonFiles = index.entries
    .filter((entry) => !entry.isDirectory && entry.id.path.startsWith('json/') && entry.id.path.endsWith('.json'))
    .map((entry) => entry.id.path)
    .sort()

  const expectedPaths = new Set<string>(EXPECTED_SNAPCHAT_JSON_PATHS)
  const mediaEntries = index.entries.filter((entry) => !entry.isDirectory && isMediaPath(entry.id.path))

  return {
    missingExpectedPaths: EXPECTED_SNAPCHAT_JSON_PATHS.filter((path) => !hasPath(index, path)),
    unknownJsonFiles: jsonFiles.filter((path) => !expectedPaths.has(path)),
    mediaCountsByDirectory: countBy(mediaEntries.map((entry) => entry.id.path.split('/')[0] ?? '')),
    mediaCountsByExtension: countBy(mediaEntries.map((entry) => extensionForPath(entry.id.path))),
    duplicateEntryPaths: findDuplicateSnapZipPaths(index),
  }
}

async function normalizeContentToArrayBuffer(
  content: ArrayBuffer | ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  if (content instanceof ArrayBuffer) {
    return content
  }

  const response = new Response(content)
  return response.arrayBuffer()
}

function hasPath(index: SnapZipIndex, path: string): boolean {
  return Boolean(findSnapZipEntryByPath(index, path))
}

function hasPrefix(index: SnapZipIndex, prefix: string): boolean {
  return findSnapZipEntriesByPrefix(index, prefix).some((entry) => !entry.isDirectory)
}

function isMediaPath(path: string): boolean {
  return path.startsWith('memories/') || path.startsWith('chat_media/')
}

function extensionForPath(path: string): string {
  const match = /\.([^.]+)$/.exec(path)
  return match?.[1]?.toLowerCase() ?? 'unknown'
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

