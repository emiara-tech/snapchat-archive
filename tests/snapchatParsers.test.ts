/// <reference types="vitest" />

import { describe, expect, it } from 'vitest'
import { parseMemoriesHistoryJson } from '../src/lib/snapchatParsers'

describe('snapchat parsers', () => {
  it('parses image and video memories into archive file paths', () => {
    const memories = parseMemoriesHistoryJson({
      'Saved Media': [
        {
          Date: '2026-03-21 09:12:33 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: 59.91387, 10.75225',
          'Download Link': 'https://example.invalid/download?mid=image-mid',
        },
        {
          Date: '2026-03-22 18:47:05 UTC',
          'Media Type': 'Video',
          Location: '',
          'Download Link': 'https://example.invalid/download?mid=video-mid',
        },
        {
          Date: '2026-03-23 18:47:05 UTC',
          'Media Type': 'vIdEo',
          'Download Link': 'https://example.invalid/download?mid=mixed-case-video-mid',
        },
        {
          Date: '2026-03-24 18:47:05 UTC',
          'Media Type': 'AR_UNKNOWN',
          'Download Link': 'https://example.invalid/download?mid=unknown-mid',
        },
        {
          Date: '2026-03-22 18:47:05 UTC',
          'Media Type': 'AR_UNKNOWN',
          'Download Link': 'https://example.invalid/download',
        },
        {
          Date: null,
          'Media Type': 'Image',
          'Download Link': 'https://example.invalid/download?mid=missing-date-mid',
        },
      ],
    })

    expect(memories).toEqual([
      {
        date: '2026-03-21 09:12:33 UTC',
        mediaType: 'Image',
        location: 'Latitude, Longitude: 59.91387, 10.75225',
        mainFilePath: 'memories/2026-03-21_image-mid-main.jpg',
        overlayFilePath: 'memories/2026-03-21_image-mid-overlay.png',
      },
      {
        date: '2026-03-22 18:47:05 UTC',
        mediaType: 'Video',
        location: null,
        mainFilePath: 'memories/2026-03-22_video-mid-main.mp4',
        overlayFilePath: 'memories/2026-03-22_video-mid-overlay.png',
      },
      {
        date: '2026-03-23 18:47:05 UTC',
        mediaType: 'vIdEo',
        location: null,
        mainFilePath: 'memories/2026-03-23_mixed-case-video-mid-main.mp4',
        overlayFilePath: 'memories/2026-03-23_mixed-case-video-mid-overlay.png',
      },
      {
        date: '2026-03-24 18:47:05 UTC',
        mediaType: 'AR_UNKNOWN',
        location: null,
        mainFilePath: 'memories/2026-03-24_unknown-mid-main.jpg',
        overlayFilePath: 'memories/2026-03-24_unknown-mid-overlay.png',
      },
    ])
  })

  it('never carries a remote download link into parsed memories', () => {
    const link =
      'https://app.snapchat.com/dmd/memories?uid=real-user-id&mid=real-memory-id&sig=secret'
    const memories = parseMemoriesHistoryJson({
      'Saved Media': [
        {
          Date: '2026-03-21 09:12:33 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: 59.91387, 10.75225',
          'Download Link': link,
        },
      ],
    })

    expect(memories).toHaveLength(1)
    const [memory] = memories

    // No field may retain the URL, its host, or its signature.
    const serialized = JSON.stringify(memory)
    expect(serialized).not.toContain(link)
    expect(serialized).not.toContain('snapchat.com')
    expect(serialized).not.toContain('https')
    expect(serialized).not.toContain('secret')
    expect(Object.keys(memory)).not.toContain('Download Link')

    // Media resolves against the export's own memories/ directory instead.
    expect(memory.mainFilePath).toBe(
      'memories/2026-03-21_real-memory-id-main.jpg',
    )
    expect(memory.overlayFilePath).toBe(
      'memories/2026-03-21_real-memory-id-overlay.png',
    )
  })

  it('drops memories whose link cannot yield a local archive path', () => {
    const memories = parseMemoriesHistoryJson({
      'Saved Media': [
        {
          Date: '2026-03-21 09:12:33 UTC',
          'Media Type': 'Image',
          // mid smuggles an absolute URL, which must not become a media path.
          'Download Link':
            'https://app.snapchat.com/dmd/memories?mid=https://evil.invalid/x',
        },
        {
          Date: '2026-03-22 09:12:33 UTC',
          'Media Type': 'Image',
          // mid escapes the memories/ directory.
          'Download Link': 'https://app.snapchat.com/dmd/memories?mid=../../etc',
        },
        {
          Date: '2026-03-23 09:12:33 UTC',
          'Media Type': 'Image',
          'Download Link': 'not-a-url',
        },
        {
          Date: '2026-03-24 09:12:33 UTC',
          'Media Type': 'Image',
        },
      ],
    })

    expect(memories).toEqual([])
  })

  it('returns an empty list for missing Saved Media', () => {
    expect(parseMemoriesHistoryJson({})).toEqual([])
    expect(parseMemoriesHistoryJson(null)).toEqual([])
  })
})
