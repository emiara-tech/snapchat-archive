/// <reference types="vitest" />

import { describe, expect, it } from 'vitest'
import { computeStats } from '../src/lib/computeStats'
import type { ChatHistory, MemoryRecord } from '../src/types'

describe('computeStats', () => {
  it('uses dated archive records for range and memory counts', () => {
    const memories: MemoryRecord[] = [
      {
        date: '2020-01-02 10:00:00 UTC',
        mediaType: 'Image',
        location: null,
        downloadLink: null,
        mediaDownloadUrl: null,
      },
      {
        date: '2020-01-05 10:00:00 UTC',
        mediaType: 'Video',
        location: null,
        downloadLink: null,
        mediaDownloadUrl: null,
      },
    ]

    const chatHistory: ChatHistory = {
      friend: [
        {
          From: 'friend',
          'Media Type': 'TEXT',
          Created: '2020-01-03 10:00:00 UTC',
          Content: 'hello',
          'Conversation Title': null,
          IsSender: false,
          'Created(microseconds)': 1,
          IsSaved: true,
          'Media IDs': '',
        },
        {
          From: 'me',
          'Media Type': 'TEXT',
          Created: '2020-01-04 10:00:00 UTC',
          Content: 'hi',
          'Conversation Title': null,
          IsSender: true,
          'Created(microseconds)': 2,
          IsSaved: true,
          'Media IDs': '',
        },
      ],
    }

    const stats = computeStats({
      friends: [],
      snapHistory: null,
      chatHistory,
      storyHistory: null,
      memories,
      indexedMediaBytes: 1536,
    })

    expect(stats.totalMemories).toBe(2)
    expect(stats.totalChats).toBe(2)
    expect(stats.dateRange).toEqual({ start: '2020-01-02', end: '2020-01-05' })
    expect(stats.longestChatActiveRunDays).toBe(2)
    expect(stats.totalIndexedMediaSize).toBe('1.5 KB')
  })
})

