import { createPublicClient, http } from 'viem'
import { CHAIN, RPC_URL } from './env.ts'

/** Read-only client for the app chain, shared by hooks that read the vaults directly. */
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })
