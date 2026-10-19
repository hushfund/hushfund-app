import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fromPath, toPath, type View } from '../src/lib/appRoutes.ts'

test('app root and logo destination open the dashboard, never marketing', () => {
  assert.equal(fromPath('/'), 'dashboard')
  assert.equal(fromPath('/app'), 'dashboard')
  assert.equal(fromPath(toPath('dashboard')), 'dashboard')
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /import\s+\{\s*Landing\s*\}|<Landing\b|go\('landing'\)/)
  assert.match(source, /onClick=\{\(\) => go\('dashboard'\)\}/)
})

test('all feature and documentation URLs remain directly reachable', () => {
  for (const page of ['dashboard', 'deposit', 'withdraw', 'borrow', 'notes', 'activity', 'docs'] as View[]) {
    assert.equal(fromPath(toPath(page)), page)
    assert.equal(fromPath(`${toPath(page)}/`), page)
  }
})
