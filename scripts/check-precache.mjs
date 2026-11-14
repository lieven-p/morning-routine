import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const swPath = join('dist', 'sw.js')
const sw = readFileSync(swPath, 'utf8')
const precached = new Set([...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]))

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  )

const missing = listFiles('public')
  .map((file) => relative('public', file).split(sep).join('/'))
  .filter((file) => !file.endsWith('.gitkeep') && !precached.has(file))

if (missing.length > 0) {
  console.error('Not in the service worker precache manifest (extend workbox.globPatterns):')
  for (const file of missing) console.error(`  public/${file}`)
  process.exit(1)
}
console.log(`Precache check passed (${precached.size} entries).`)
