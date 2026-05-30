/// <reference types="vitest" />

import { describe, expect, it } from 'vitest'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

import { createArchiveSession } from '../src/lib/snapArchive'

describe('snapchat archive session', () => {
  it('detects memories_history.json and media directories', async () => {
    const file = await createZipFile({
      'json/account.json': '{"Basic Information":{"Username":"me"}}',
      'json/friends.json': '{"Friends":[]}',
      'json/chat_history.json': '{}',
      'json/snap_history.json': '{}',
      'json/story_history.json': '{"Your Story Views":[]}',
      'json/memories_history.json': '{"Saved Media":[]}',
      'json/extra_export_file.json': '{}',
      'memories/2026-01-01_example-main.jpg': 'image',
      'chat_media/2026-01-01_example.jpg': 'image',
    })

    const session = await createArchiveSession([file])

    expect(session.metadata.capabilities.hasMemoriesHistoryJson).toBe(true)
    expect(session.metadata.capabilities.hasMemoriesDirectory).toBe(true)
    expect(session.metadata.capabilities.hasChatMediaDirectory).toBe(true)
    expect(session.metadata.stats.hasMemoriesHistory).toBe(true)
    expect(session.metadata.diagnostics.missingExpectedPaths).not.toContain('json/photos_history.json')
    expect(session.metadata.diagnostics.unknownJsonFiles).toContain('json/extra_export_file.json')
    expect(session.metadata.diagnostics.mediaCountsByDirectory).toEqual({
      chat_media: 1,
      memories: 1,
    })
  })

  it('resolves mp4 memories to object URLs', async () => {
    const file = await createZipFile({
      'json/account.json': '{"Basic Information":{"Username":"me"}}',
      'json/friends.json': '{"Friends":[]}',
      'json/chat_history.json': '{}',
      'json/snap_history.json': '{}',
      'json/story_history.json': '{"Your Story Views":[]}',
      'json/memories_history.json': '{"Saved Media":[]}',
      'memories/2026-01-01_example-main.mp4': 'video',
    })

    const session = await createArchiveSession([file])
    const url = await session.reader.readMediaBlob('memories/2026-01-01_example-main.mp4')

    expect(url).toEqual(expect.stringMatching(/^blob:/))
    if (url) URL.revokeObjectURL(url)
  })
})

async function createZipFile(files: Record<string, string>): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  for (const [path, content] of Object.entries(files)) {
    await writer.add(path, new TextReader(content))
  }
  const blob = (await writer.close()) as Blob
  return new File([blob], 'snapchat-export.zip', { type: 'application/zip' })
}
