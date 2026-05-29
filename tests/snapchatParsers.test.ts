/// <reference types="vitest" />

import { describe, expect, it } from 'vitest'
import { parseMemoriesHistoryJson } from '../src/lib/snapchatParsers'

describe('snapchat parsers', () => {
  it('parses memories_history.json Saved Media records defensively', () => {
    const memories = parseMemoriesHistoryJson({
      'Saved Media': [
        {
          Date: '2026-03-21 09:12:33 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: 59.91387, 10.75225',
          'Download Link': 'https://example.invalid/download',
          'Media Download Url': 'https://example.invalid/media',
        },
        {
          Date: '2026-03-22 18:47:05 UTC',
          'Media Type': 'AR_UNKNOWN',
        },
        {
          Date: null,
          'Media Type': 'Image',
        },
      ],
    })

    expect(memories).toEqual([
      {
        date: '2026-03-21 09:12:33 UTC',
        mediaType: 'Image',
        location: 'Latitude, Longitude: 59.91387, 10.75225',
        downloadLink: 'https://example.invalid/download',
        mediaDownloadUrl: 'https://example.invalid/media',
      },
      {
        date: '2026-03-22 18:47:05 UTC',
        mediaType: 'AR_UNKNOWN',
        location: null,
        downloadLink: null,
        mediaDownloadUrl: null,
      },
    ])
  })

  it('returns an empty list for missing Saved Media', () => {
    expect(parseMemoriesHistoryJson({})).toEqual([])
    expect(parseMemoriesHistoryJson(null)).toEqual([])
  })
})

