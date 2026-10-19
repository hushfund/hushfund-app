import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { OpenfortButton } from '../components/SignInButton.tsx'
import { Head, useUi } from '../components/ui.tsx'
import { RecipientField, usdcStr } from './shared.tsx'
import { useActions } from '../hooks/useActions.ts'
import { useAppConfig, useUsdcBalance } from '../hooks/useVaultData.ts'
import { useRecipient } from '../hooks/useEns.ts'
import { SUPPORTED_CHAINS, COMMON_TOKENS, SOURCE_CHAIN_ID } from '../constants/chains.ts'

/**
 * Optional second step: move USDC from the wallet that received a withdrawal to another chain with LI.FI.
 * Run it signed in with the RECIPIENT wallet (not the one you deposited from), which pays the gas in ETH.
 */
export function BridgeCard() {
  const { data: config } = useAppConfig()
  const { address, isConnected } = useAccount()
  const { balance } = useUsdcBalance(config?.usdc, address)
  const { bridge } = useActions(config)
  const { busy } = useUi()
  const dest = SUPPORTED_CHAINS.filter((c) => c.chainId !== SOURCE_CHAIN_ID)
  const [chainId, setChainId] = useState(dest[0]?.chainId ?? 42161)
  const tokens = COMMON_TOKENS[chainId] ?? []
  const [token, setToken] = useState(tokens[0]?.address ?? '')
  const [to, setTo] = useState('')
  const recipient = useRecipient(to)

  // a recipient's ENS records can ask for a chain/token (hushfund.chain / hushfund.token)
  useEffect(() => {
    if (recipient.chain) setChainId(recipient.chain.chainId)
  }, [recipient.chain])
  useEffect(() => {
    const list = COMMON_TOKENS[chainId] ?? []
    setToken(recipient.token && list.some((t) => t.address === recipient.token!.address) ? recipient.token.address : list[0]?.address ?? '')
  }, [chainId, recipient.token])

  const label = dest.find((c) => c.chainId === chainId)?.name ?? ''
  return (
    <section className="card" style={{ ['--i' as string]: 2, gridColumn: '1 / -1' }}>
      <Head title="Bridge to another chain (optional)" value={<p className="big num">{balance === undefined ? '—' : usdcStr(balance, 2)}</p>} />
      <p className="muted" style={{ fontSize: 12.5 }}>
        After a withdrawal arrives, sign in with the <b>receiving</b> wallet and send the USDC to another chain with LI.FI. That wallet pays the gas in ETH. Do not use the wallet you deposited from, or the two can be linked.
      </p>
      <div className="inline">
        <select className="select" value={chainId} onChange={(e) => setChainId(Number(e.target.value))} aria-label="Destination chain">
          {dest.map((c) => <option key={c.chainId} value={c.chainId}>{c.name}</option>)}
        </select>
        <select className="select" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Destination token">
          {tokens.map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
        </select>
      </div>
      <RecipientField id="br-dest" value={to} onChange={setTo} me={address} />
      {isConnected ? (
        <button className="primary" disabled={busy || !recipient.address || !balance}
          onClick={() => recipient.address && balance && bridge({ amount: balance, toChainId: chainId, toToken: token, toAddress: recipient.address, label })}>
          Bridge {balance ? usdcStr(balance, 2) : ''} to {label}
        </button>
      ) : (
        <OpenfortButton label="Sign in with the receiving wallet" />
      )}
    </section>
  )
}
