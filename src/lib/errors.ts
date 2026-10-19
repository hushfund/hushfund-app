// Contract errors first: bundlers and relayers wrap them in longer messages.
const ERROR_MAP: [RegExp, string][] = [
  [/user rejected|user denied|rejected the request/i, 'You rejected the request in your wallet.'],
  [/NoteAlreadySpent/i, 'This note has already been used.'],
  [/CollateralLocked/i, 'This note backs an active loan. Repay the loan before withdrawing.'],
  [/LoanAlreadyActive/i, 'This note already has an active loan.'],
  [/NoActiveLoan/i, 'There is no active loan on this note.'],
  [/DepositAlreadyWithdrawn/i, 'This deposit has already been withdrawn.'],
  [/BorrowAmountExceedsLTV/i, 'That amount is above the 70% borrow limit.'],
  [/CommitmentAlreadyAdded/i, 'This commitment was already deposited.'],
  [/UnknownRoot/i, 'New deposits arrived while the proof was being made. Try again.'],
  [/InvalidProof/i, 'The proof was rejected. Try again; if it repeats, check that the note is complete.'],
  [/NotAFieldElement|InvalidYieldIndex/i, 'The note is malformed.'],
  [/DepositValueMismatch/i, 'The signed amount does not match the vault size.'],
  [/AuthorizationMismatch/i, 'The signature does not match this deposit. Sign again.'],
  [/InsufficientRepayment/i, 'The authorised amount is below the current debt. Try again.'],
  [/InsufficientLiquidity/i, 'Aave or Morpho is temporarily out of liquidity. Try again later.'],
  [/EnforcedPause/i, 'Deposits and new loans are paused right now. Withdrawals and repayments still work.'],
  [/fee too low/i, 'Gas prices moved. Fetch a new relayer quote and try again.'],
  [/out of gas funds/i, 'The relayer is out of gas funds. Try again later.'],
  [/Commitment not found/i, 'This note was not found in the vault.'],
  [/insufficient funds|transfer amount exceeds balance/i, 'Insufficient USDC balance.'],
  [/Failed to fetch|NetworkError|ETIMEDOUT|ECONNREFUSED/i, 'Could not reach the Hushfund server. Check your connection.'],
]

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  for (const [re, msg] of ERROR_MAP) if (re.test(raw)) return msg
  return raw.length < 160 ? raw : 'Something went wrong. Please try again.'
}
