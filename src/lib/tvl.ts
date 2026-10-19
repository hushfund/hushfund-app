/** USDC base units, summed without floating-point loss. Missing data is not zero. */
export function sumTvl(values: (string | undefined)[]): bigint | undefined {
  if (!values.length || values.some(value => typeof value !== 'string' || !/^\d+$/.test(value))) return undefined
  return values.reduce<bigint>((sum, value) => sum + BigInt(value!), 0n)
}

/** Preserve six-decimal USDC precision below $1, otherwise round to cents. */
export function formatTvl(units: bigint): string {
  if (units < 1_000_000n) {
    const fraction = units.toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0')
    return `$0.${fraction}`
  }
  const cents = (units + 5_000n) / 10_000n
  return `$${(cents / 100n).toLocaleString('en-US')}.${(cents % 100n).toString().padStart(2, '0')}`
}
