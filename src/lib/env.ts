import { mainnet } from 'viem/chains'

/** This application supports Ethereum Mainnet only. */
export function getEnv(key: keyof ImportMetaEnv): string | undefined {
  return window.__HUSHFUND_ENV__?.[key]
}
export const NETWORK = getEnv('VITE_NETWORK') ?? 'mainnet'
if (NETWORK !== 'mainnet') throw new Error('VITE_NETWORK must be mainnet')
export const CHAIN = mainnet
export const NOTE_NETWORK = 'ethereum'

/** Empty or unset in a production build = same origin (the backend serves the web app, behind a reverse proxy). */
export const API_URL: string = (
  getEnv('VITE_API_URL') ?? ''
).replace(/\/$/, '')
export const IS_AUTH_CONFIGURED = Boolean(getEnv('VITE_OPENFORT_PUBLISHABLE_KEY'))
export const RPC_URL: string | undefined = getEnv('VITE_RPC_URL') || undefined
/** ENS resolves on Ethereum Mainnet. */
export const MAINNET_RPC_URL: string | undefined = getEnv('VITE_MAINNET_RPC_URL') || RPC_URL

export const EXPLORER = 'https://etherscan.io'
