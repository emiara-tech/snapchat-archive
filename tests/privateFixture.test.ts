/// <reference types="vitest" />

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fixturePath = join(process.cwd(), 'example_export')

describe.skipIf(!existsSync(fixturePath))('private example_export fixture', () => {
  it('matches the current Snapchat export structure this app targets', () => {
    const jsonFiles = readdirSync(join(fixturePath, 'json')).sort()
    const memoryFiles = readdirSync(join(fixturePath, 'memories'))
    const chatMediaFiles = readdirSync(join(fixturePath, 'chat_media'))

    expect(jsonFiles).toContain('memories_history.json')
    expect(jsonFiles).not.toContain('photos_history.json')
    expect(memoryFiles.length).toBeGreaterThan(0)
    expect(chatMediaFiles.length).toBeGreaterThan(0)
    expect(statSync(fixturePath).isDirectory()).toBe(true)
  })
})

