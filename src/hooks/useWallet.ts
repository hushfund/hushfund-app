import { useCallback } from 'react'
import { useWalletClient } from 'wagmi'
import { CHAIN } from '../lib/env.ts'
import { publicClient } from '../lib/client.ts'
import { assertMainnetWallet, sendWalletCalls, type WalletCall } from '../lib/transactions.ts'

/**
 * Sends transactions from the signed-in wallet. The user pays gas in ETH from that wallet.
 * Calls run one after another; each waits for its receipt before the next is sent.
 */
export function useWallet() {
  const { data: walletClient } = useWalletClient({ chainId: CHAIN.id })

  const send = useCallback(
    async (calls: WalletCall[]) => {
      if (!walletClient) throw new Error('Sign in first')
      return sendWalletCalls(walletClient, publicClient, calls)
    },
    [walletClient],
  )

  const assertReady = useCallback(async () => {
    if (!walletClient) throw new Error('Sign in first')
    await assertMainnetWallet(walletClient, walletClient.account.address)
  }, [walletClient])

  return { send, assertReady, publicClient, address: walletClient?.account.address }
}
