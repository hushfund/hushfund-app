import test from 'node:test'
import assert from 'node:assert/strict'
import { assertMainnetWallet, sendWalletCalls, waitForConfirmedTransaction } from '../src/lib/transactions.ts'
import { bridgeDelivered, validateLiFiQuote } from '../src/hooks/useLiFi.ts'

const address = '0x0000000000000000000000000000000000000001'
const other = '0x0000000000000000000000000000000000000002'
const hash = '0x' + 'ab'.repeat(32)
const replacementHash = '0x' + 'cd'.repeat(32)
const call = { to: other, data: '0x1234' }
const wallet = (overrides = {}) => ({
  account: { address },
  getChainId: async () => 1,
  getAddresses: async () => [address],
  sendTransaction: async () => hash,
  ...overrides,
})

test('only the intended Mainnet account can send', async () => {
  await assertMainnetWallet(wallet(), address)
  await assert.rejects(assertMainnetWallet(wallet({ getChainId: async () => 999 }), address), /Mainnet/)
  await assert.rejects(assertMainnetWallet(wallet({ getAddresses: async () => [other] }), address), /account changed/)
  let sends = 0
  await assert.rejects(sendWalletCalls(wallet({
    getChainId: async () => 999,
    sendTransaction: async () => { sends++; return hash },
  }), {}, [call]), /Mainnet/)
  assert.equal(sends, 0)
})

test('reverted approval prevents the next transaction', async () => {
  let sends = 0
  await assert.rejects(sendWalletCalls(wallet({
    sendTransaction: async () => { sends++; return hash },
  }), { waitForTransactionReceipt: async () => ({ status: 'reverted' }) }, [call, call]), /reverted/)
  assert.equal(sends, 1)
})

test('account changes between sequential calls stop the remaining calls', async () => {
  let sends = 0
  await assert.rejects(sendWalletCalls(wallet({
    getAddresses: async () => [sends ? other : address],
    sendTransaction: async () => { sends++; return hash },
  }), { waitForTransactionReceipt: async () => ({ status: 'success', transactionHash: hash }) }, [call, call]), /account changed/)
  assert.equal(sends, 1)
})

test('successful sequential calls wait for approval and use Mainnet', async () => {
  const order = []
  const result = await sendWalletCalls(wallet({ sendTransaction: async p => {
    assert.equal(p.chain.id, 1)
    order.push('send')
    return hash
  } }), { waitForTransactionReceipt: async () => {
    order.push('receipt')
    return { status: 'success', transactionHash: hash }
  } }, [call, call])
  assert.equal(result, hash)
  assert.deepEqual(order, ['send', 'receipt', 'send'])
  await assert.rejects(sendWalletCalls(wallet(), {}, []), /No transaction/)
})

test('repricing returns the final receipt; cancellation or changed action never reports success', async () => {
  for (const reason of ['repriced', 'cancelled', 'replaced']) {
    const promise = waitForConfirmedTransaction({
      waitForTransactionReceipt: async ({ onReplaced }) => {
        onReplaced({ reason })
        return { status: 'success', transactionHash: replacementHash }
      },
    }, hash)
    if (reason === 'repriced') assert.equal((await promise).transactionHash, replacementHash)
    else await assert.rejects(promise, /cancelled or replaced/)
  }
})

const request = { fromAmount: '10000000', fromAddress: address, toAddress: other, toChainId: 8453, toToken: other, fromToken: address }
const quote = {
  transactionRequest: { chainId: 1, to: other, data: '0x1234', value: '0' },
  action: { fromChainId: 1, toChainId: 8453, fromAmount: '10000000', fromAddress: address, toAddress: other,
    fromToken: { address }, toToken: { address: other, symbol: 'USDC', decimals: 6 } },
  estimate: { approvalAddress: other },
}
test('bridge quotes must match the requested chain, recipient, amount, and token', () => {
  assert.equal(validateLiFiQuote(quote, request), quote)
  for (const patch of [
    { toAddress: address }, { fromAmount: '20000000' }, { fromChainId: 999 },
    { toChainId: 999 }, { fromToken: { address: other } }, { toToken: { address } },
  ]) {
    assert.throws(() => validateLiFiQuote({ ...quote, action: { ...quote.action, ...patch } }, request), /does not match/)
  }
  assert.throws(() => validateLiFiQuote({ ...quote, transactionRequest: { ...quote.transactionRequest, chainId: 999 } }, request), /does not match/)
  assert.throws(() => validateLiFiQuote({ ...quote, estimate: { approvalAddress: 'invalid' } }, request), /does not match/)
  assert.throws(() => validateLiFiQuote(null, request), /does not match/)
})

test('partial delivery or a refund cannot be displayed as a full bridge delivery', () => {
  assert.equal(bridgeDelivered({ status: 'PENDING' }), false)
  assert.equal(bridgeDelivered({ status: 'DONE', substatus: 'COMPLETED' }), true)
  for (const substatus of ['PARTIAL', 'REFUNDED', undefined]) {
    assert.throws(() => bridgeDelivered({ status: 'DONE', substatus }), /did not deliver/)
  }
  assert.throws(() => bridgeDelivered({ status: 'FAILED' }), /bridge failed/)
})
