import { AccountTypeEnum, AuthProvider, getDefaultConfig, OpenfortProvider, RecoveryMethod } from '@openfort/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { mainnet } from 'viem/chains'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { API_URL, getEnv, IS_AUTH_CONFIGURED, RPC_URL } from './lib/env.ts'
import { requestWalletSession } from './lib/wallet-session.ts'

const chains = [mainnet] as const

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Hushfund',
    appUrl: window.location.origin,
    appIcon: `${window.location.origin}/brand/hushfund-logo-original.png`,
    chains,
    transports: { [mainnet.id]: http(RPC_URL) },
    walletConnectProjectId: getEnv('VITE_WALLET_CONNECT_PROJECT_ID') ?? '',
  }),
)

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } } }),
  )
  // Public pages do not require authentication. Only mount Openfort once configured.
  if (!IS_AUTH_CONFIGURED) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    )
  }
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OpenfortProvider
          publishableKey={getEnv('VITE_OPENFORT_PUBLISHABLE_KEY') ?? ''}
          walletConfig={{
            shieldPublishableKey: getEnv('VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY') ?? '',
            getEncryptionSession: async ({ accessToken, userId, otpCode }) => {
              const endpoint = getEnv('VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT') ||
                `${API_URL || window.location.origin}/api/protected-create-encryption-session`
              return requestWalletSession({
                endpoint, apiOrigin: new URL(API_URL || window.location.origin, window.location.origin).origin,
                accessToken: accessToken ?? undefined, userId, otpCode,
              })
            },
            accountType: AccountTypeEnum.EOA,
          }}
          uiConfig={{
            authProviders: [AuthProvider.EMAIL_OTP, AuthProvider.GOOGLE, AuthProvider.WALLET],
            walletRecovery: {
              defaultMethod: RecoveryMethod.PASSKEY,
              allowedMethods: [RecoveryMethod.PASSWORD, RecoveryMethod.AUTOMATIC, RecoveryMethod.PASSKEY],
            },
          }}
        >
          {children}
        </OpenfortProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
