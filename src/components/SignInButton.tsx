import { OpenfortButton as ConfiguredSignInButton, useConnectWithSiwe, useUI, useUser } from '@openfort/react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { IS_AUTH_CONFIGURED } from '../lib/env.ts'
import { shortHex } from '../lib/format.ts'

function ConfiguredButton({ label }: { label?: string }) {
  const { isAuthenticated } = useUser()
  const { openProviders, openWallets } = useUI()
  const { address } = useAccount()
  const connectWithSiwe = useConnectWithSiwe()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  // The SDK's default button labels a connected external wallet without an
  // Openfort user as "Loading user..." indefinitely. These are distinct states.
  if (isAuthenticated) return (
    <span className="auth-controls" data-auth-state="signed-in">
      <span className="small" role="status">Signed in</span>
      <ConfiguredSignInButton label={label} />
    </span>
  )
  return (
    <span className="auth-controls" data-auth-state={address ? 'wallet-connected' : 'signed-out'}>
      {address && (
        <button type="button" disabled={pending} onClick={openWallets} aria-label="Choose connected wallet">
          {shortHex(address)}
        </button>
      )}
      <button type="button" className="primary" style={{ marginTop: 0, width: 'auto' }} disabled={pending} onClick={async () => {
        setError('')
        if (!address) { openProviders(); return }
        setPending(true)
        try {
          await connectWithSiwe({
            onError: () => setError('Wallet sign-in failed or was cancelled. Try again or choose another sign-in method.'),
          })
        } catch {
          setError('Wallet sign-in is unavailable. Try again or choose another sign-in method.')
        } finally {
          setPending(false)
        }
      }}>
        {pending ? 'Confirm sign-in in your wallet…' : label ?? 'Sign in'}
      </button>
      {address && <button type="button" disabled={pending} onClick={openProviders}>Other sign-in options</button>}
      {error && <span className="small" role="alert">{error}</span>}
    </span>
  )
}

/** Preserve the existing login flow, but never mount it without its provider. */
export function OpenfortButton({ label }: { label?: string }) {
  if (IS_AUTH_CONFIGURED) return <ConfiguredButton label={label} />
  return (
    <button
      type="button"
      className="primary"
      disabled
      title="Sign-in is unavailable until Openfort is configured."
    >
      Sign-in unavailable
    </button>
  )
}
