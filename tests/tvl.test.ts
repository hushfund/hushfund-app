import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTvl, sumTvl } from '../src/lib/tvl.ts'

test('TVL sums base units exactly beyond the safe Number range', () => {
  assert.equal(sumTvl(['9007199254740993', '1']), 9007199254740994n)
})

test('missing, empty or malformed snapshots are unavailable, not zero', () => {
  for (const values of [[], ['100', undefined], ['100', '-1'], ['NaN'], ['']]) {
    assert.equal(sumTvl(values), undefined)
  }
  assert.equal(sumTvl(['0', '0']), 0n)
})

test('small nonzero TVL is not rounded to zero', () => {
  assert.equal(formatTvl(0n), '$0.00')
  assert.equal(formatTvl(1n), '$0.000001')
  assert.equal(formatTvl(1718n), '$0.001718')
  assert.equal(formatTvl(100_000n), '$0.10')
})

test('larger TVL rounds to cents using integer arithmetic', () => {
  assert.equal(formatTvl(1_005_000n), '$1.01')
  assert.equal(formatTvl(1_234_567_890n), '$1,234.57')
})
