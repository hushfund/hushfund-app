import test from 'node:test'
import assert from 'node:assert/strict'
import { requestWalletSession } from '../src/lib/wallet-session.ts'

const input = {
  endpoint: '/api/protected-create-encryption-session', apiOrigin: 'https://app.fixture.invalid',
  accessToken: 'fixture-access-not-a-real-token', userId: 'fixture-user',
}
test('wallet credentials are sent only to the configured API, with no redirects or caching', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, input.apiOrigin)
    assert.equal(options.redirect, 'error')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.headers.Authorization, `Bearer ${input.accessToken}`)
    assert.deepEqual(JSON.parse(options.body), { user_id: input.userId })
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json({ session: 'fixture-session' })
  })
  assert.equal(await requestWalletSession(input), 'fixture-session')
})
test('missing authentication and foreign endpoints fail before any network request', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error() })
  await assert.rejects(requestWalletSession({ ...input, accessToken: '' }), /sign in again/)
  await assert.rejects(requestWalletSession({ ...input, userId: '' }), /sign in again/)
  for (const endpoint of ['https://foreign.fixture.invalid/session', 'https://user:pass@app.fixture.invalid/session', 'javascript:void(0)']) {
    await assert.rejects(requestWalletSession({ ...input, endpoint }), /not configured/)
  }
  assert.equal(requests, 0)
})
test('expired or unauthorized sessions get actionable safe messages', async t => {
  for (const [status, message] of [[401, /expired/], [403, /cannot access/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'PRIVATE_PROVIDER_DETAIL' }, { status }))
    await assert.rejects(requestWalletSession(input), message)
  }
})
test('provider failures and malformed session responses never expose provider detail', async t => {
  for (const response of [
    Response.json({ error: 'PRIVATE_PROVIDER_DETAIL' }, { status: 503 }),
    new Response('<html>PRIVATE_PROVIDER_DETAIL</html>'),
    Response.json({ session: '' }),
    Response.json(null),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response)
    await assert.rejects(requestWalletSession(input), e => /unavailable/.test(e.message) && !e.message.includes('PRIVATE_PROVIDER_DETAIL'))
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('PRIVATE_PROVIDER_DETAIL') })
  await assert.rejects(requestWalletSession(input), /could not be reached/)
})
