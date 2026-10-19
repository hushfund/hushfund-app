/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: 'mainnet'
  readonly VITE_API_URL?: string
  readonly VITE_RPC_URL?: string
  readonly VITE_MAINNET_RPC_URL?: string
  readonly VITE_OPENFORT_PUBLISHABLE_KEY: string
  readonly VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY: string
  readonly VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT?: string
  readonly VITE_WALLET_CONNECT_PROJECT_ID?: string
  readonly VITE_DOCS_URL?: string
  readonly VITE_GUIDE_URL?: string
  readonly VITE_X_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __HUSHFUND_ENV__?: Readonly<Record<string, string>>
  __HUSHFUND_ENV_READY__?: Promise<void>
}

// Polyfilled in main.tsx for libraries (bb.js, WalletConnect) that expect Node's Buffer.
// eslint-disable-next-line no-var
declare var Buffer: typeof import('buffer').Buffer
