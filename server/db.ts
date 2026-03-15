import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdirSync } from 'node:fs'
import * as schema from './schema'

const DB_PATH = process.env.DB_PATH || './data/shredded.db'
mkdirSync('./data', { recursive: true })
mkdirSync('./data/uploads', { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
