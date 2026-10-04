// Guestbook entries live in one JSON object in a Lightsail bucket (or a local
// file in development). The service is a single container, so an in-memory
// copy plus serialized writes is enough.
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { s3Object } from './s3.mjs'

const MAX_ENTRIES = 500
export const MAX_MESSAGE = 280
export const MAX_NAME = 32

function storage() {
  const { GUESTBOOK_BUCKET: bucket, GUESTBOOK_ACCESS_KEY_ID: accessKeyId, GUESTBOOK_SECRET_ACCESS_KEY: secretAccessKey } = process.env
  if (bucket && accessKeyId && secretAccessKey) return s3Object({ bucket, key: 'guestbook.json', region: process.env.GUESTBOOK_REGION ?? 'us-east-1', accessKeyId, secretAccessKey })
  // A container's disk is wiped on every deploy, so production needs the bucket.
  if (process.env.NODE_ENV === 'production' && !process.env.GUESTBOOK_FILE) return null
  const file = process.env.GUESTBOOK_FILE ?? join(tmpdir(), 'portfolio-guestbook.json')
  return { get: () => readFile(file, 'utf8').catch(() => null), put: (text) => writeFile(file, text) }
}

const store = storage()
let entries = null
let queue = Promise.resolve()

async function load() {
  if (entries) return entries
  if (!store) throw new Error('guestbook storage is not configured')
  const text = await store.get()
  const parsed = text ? JSON.parse(text) : []
  entries = Array.isArray(parsed) ? parsed : []
  return entries
}

// Plain text only: no control or bidi-override characters, collapsed spaces,
// links defanged so the guestbook is useless for spam.
export function clean(value, max) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]')
    .trim()
    .slice(0, max)
}

export function validate(body) {
  if (body?.website) return { error: 'thanks!' } // honeypot field for bots
  const name = clean(body?.name, MAX_NAME) || 'guest'
  const message = clean(body?.message, MAX_MESSAGE + 1)
  if (message.length < 2) return { error: 'write a message first' }
  if (message.length > MAX_MESSAGE) return { error: `keep it under ${MAX_MESSAGE} characters` }
  return { entry: { name, message, at: new Date().toISOString() } }
}

export async function listEntries(limit = 50) {
  return (await load()).slice(0, limit)
}

export function addEntry(entry) {
  const task = queue.then(async () => {
    const current = await load()
    entries = [entry, ...current].slice(0, MAX_ENTRIES)
    try { await store.put(JSON.stringify(entries)) } catch (error) { entries = current; throw error }
    return entry
  })
  queue = task.catch(() => {})
  return task
}
