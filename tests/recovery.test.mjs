import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptRecovery, decryptRecovery, recordRecoveryTransaction, recoveryTransaction } from '../src/lib/recovery.ts'
const draft = { version: 1, chainId: 1, action: 'deposit', vault: '0x0000000000000000000000000000000000000001', denomination: 10, draftNote: 'hushfund-usdc-10-ethereum-' + 'ab'.repeat(128), createdAt: 1 }
const password = 'recovery-fixture-password'
test('encrypted recovery round trips without plaintext note secrets', async () => {
  const encrypted = await encryptRecovery(draft, password)
  assert.ok(!JSON.stringify(encrypted).includes(draft.draftNote))
  assert.deepEqual(await decryptRecovery(encrypted, password), draft)
})
test('each encrypted file has a fresh salt and IV', async () => {
  const a = await encryptRecovery(draft, password)
  const b = await encryptRecovery(draft, password)
  assert.notDeepEqual(a.salt, b.salt)
  assert.notDeepEqual(a.iv, b.iv)
})
test('wrong passwords and modified ciphertext cannot unlock a note', async () => {
  const encrypted = await encryptRecovery(draft, password)
  await assert.rejects(decryptRecovery(encrypted, 'wrong-password-fixture'), /Cannot unlock/)
  encrypted.ciphertext[0] ^= 1
  await assert.rejects(decryptRecovery(encrypted, password), /Cannot unlock/)
})
test('malformed and non-Mainnet backups are rejected', async () => {
  await assert.rejects(decryptRecovery({}, password), /Invalid recovery/)
  const encrypted = await encryptRecovery({ ...draft, chainId: 999 }, password)
  await assert.rejects(decryptRecovery(encrypted, password), /Ethereum Mainnet/)
  await assert.rejects(decryptRecovery(await encryptRecovery(null, password), password), /Ethereum Mainnet/)
  await assert.rejects(encryptRecovery(draft, 'short'), /12 characters/)
})
test('reload recovery journal persists only a public hash, never note secrets', async () => {
  const memory = new Map()
  globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) }
  const hash = '0x' + 'cd'.repeat(32)
  assert.equal(await recordRecoveryTransaction(draft.draftNote, hash), true)
  assert.equal(await recoveryTransaction(draft.draftNote), hash)
  assert.equal(await recoveryTransaction(draft.draftNote + 'other'), undefined)
  assert.deepEqual([...memory.values()], [hash])
  assert.ok(!JSON.stringify([...memory]).includes(draft.draftNote))
})
test('blocked browser storage never discards the external recovery backup', async () => {
  globalThis.localStorage = { setItem: () => { throw Error('blocked') }, getItem: () => { throw Error('blocked') } }
  assert.equal(await recordRecoveryTransaction(draft.draftNote, '0x' + 'ef'.repeat(32)), false)
  assert.equal(await recoveryTransaction(draft.draftNote), undefined)
})
