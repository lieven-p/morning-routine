import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { test } from 'node:test'

const RULE = 'no-restricted-imports'
const oxlint = 'node_modules/oxlint/bin/oxlint'

const lintProbe = (file, source) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, source)
  try {
    const run = spawnSync(process.execPath, [oxlint, file], { encoding: 'utf8' })
    return { status: run.status, output: `${run.stdout}${run.stderr}` }
  } finally {
    rmSync(file, { force: true })
  }
}

const violations = [
  ['domain imports app', 'src/domain/__probe__.ts', "import '../app/x'\nexport {}\n"],
  ['domain imports a package', 'src/domain/__probe__.ts', "import 'react'\nexport {}\n"],
  ['domain imports dexie', 'src/domain/__probe__.ts', "import 'dexie'\nexport {}\n"],
  ['app imports adapters', 'src/app/__probe__.ts', "import '../adapters/x'\nexport {}\n"],
  ['app imports ui', 'src/app/__probe__.ts', "import '../ui/x'\nexport {}\n"],
  ['adapters import ui', 'src/adapters/media/__probe__.ts', "import '../../ui/x'\nexport {}\n"],
  ['dexie outside adapters/db', 'src/ui/__probe__.ts', "import 'dexie'\nexport {}\n"],
  ['kids import parent', 'src/ui/kids/__probe__.ts', "import '../parent/x'\nexport {}\n"],
]

for (const [name, file, source] of violations) {
  test(`lint rejects: ${name}`, () => {
    const { status, output } = lintProbe(file, source)
    assert.notEqual(status, 0, output)
    assert.match(output, new RegExp(RULE))
  })
}

const allowed = [
  ['dexie inside adapters/db', 'src/adapters/db/__probe__.ts', "import 'dexie'\nexport {}\n"],
  ['parent imports kids', 'src/ui/parent/__probe__.ts', "import '../kids/x'\nexport {}\n"],
  ['ui imports app and domain', 'src/ui/__probe__.ts', "import '../app/x'\nimport '../domain/y'\nexport {}\n"],
  [
    'adapters import app and domain',
    'src/adapters/media/__probe__.ts',
    "import '../../app/x'\nimport '../../domain/y'\nexport {}\n",
  ],
  ['app imports domain', 'src/app/__probe__.ts', "import '../domain/x'\nexport {}\n"],
]

for (const [name, file, source] of allowed) {
  test(`lint allows: ${name}`, () => {
    const { status, output } = lintProbe(file, source)
    assert.equal(status, 0, output)
  })
}

test('lockfile resolves only from the public npm registry', () => {
  const hosts = new Set(
    [...readFileSync('package-lock.json', 'utf8').matchAll(/"resolved":\s*"https?:\/\/([^/"]+)/g)].map((m) => m[1]),
  )
  assert.deepEqual([...hosts], ['registry.npmjs.org'], 'a mirror host in the lockfile breaks CI; rewrite it to registry.npmjs.org')
})

test('build fails when a public file is missing from the precache', () => {
  assert.ok(existsSync('dist/sw.js'), 'run `npm run build` before `npm test`')
  const probe = 'public/__probe__.xyz'
  writeFileSync(probe, 'probe')
  try {
    const run = spawnSync(process.execPath, ['scripts/check-precache.mjs'], { encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.match(`${run.stdout}${run.stderr}`, /__probe__\.xyz/)
  } finally {
    rmSync(probe, { force: true })
  }
})
