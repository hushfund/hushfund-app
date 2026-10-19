import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { OpenfortButton } from '../components/SignInButton.tsx'
import { Head, Icon, useUi } from '../components/ui.tsx'
import { NoteField, NoteSummary, RecipientField, usdcStr } from './shared.tsx'
import { useActions } from '../hooks/useActions.ts'
import { useAppConfig } from '../hooks/useVaultData.ts'
import { useNoteInfo } from '../hooks/useNoteInfo.ts'
import { useRecipient } from '../hooks/useEns.ts'
import { api } from '../lib/api.ts'
import { BridgeCard } from './BridgeCard.tsx'

export function WithdrawPage({ go, initialNote }: { go: (to: string) => void; initialNote?: string }) {
  const { data: config } = useAppConfig()
  const { address, isConnected } = useAccount()
  const { withdraw } = useActions(config)
  const { busy } = useUi()
  const [note, setNote] = useState(initialNote ?? '')
  const [to, setTo] = useState('')
  const relayerAvailable = !!config?.relayer
  const [useRelayer, setUseRelayer] = useState(true)
  const viaRelayer = useRelayer && relayerAvailable

  const { info, loading, error, parseError } = useNoteInfo(note, config)
  const recipient = useRecipient(to)
  const quote = useQuery({ queryKey: ['quote', 'withdraw'], queryFn: () => api.quote('withdraw'), enabled: viaRelayer && !!info, refetchInterval: 30_000 })

  const relayerFee = viaRelayer ? BigInt(quote.data?.fee ?? 0) : 0n
  const receive = info ? info.payout - info.protocolFee - relayerFee : 0n
  const blocked = !info || info.spent || info.loanActive || receive <= 0n
  const ready = !blocked && !!recipient.address && (!viaRelayer || !!quote.data) && !busy

  const submit = () => {
    if (!info || !recipient.address) return
    withdraw({ parsed: info.parsed, recipient: recipient.address, useRelayer: viaRelayer })
  }

  return (
    <div className="pgrid">
      <section className="card" style={{ ['--i' as string]: 0 }}>
        <Head title="Withdraw" value={<p className="big num">{info && !blocked ? usdcStr(receive, 2) : '0.00 USDC'}</p>} />
        <NoteField id="wd-note" value={note} onChange={setNote} />
        <NoteSummary info={info} loading={loading} error={parseError ?? error} />
        {info?.spent && <div className="err">This note has already been withdrawn.</div>}
        {info?.loanActive && (
          <div className="warnbox">
            This note backs a loan of {usdcStr(info.debt)}. Repay it on the Borrow page first; you will get a renewed note to withdraw with.
          </div>
        )}
        {info && !blocked && (
          <div className="box num">
            <div className="line"><span className="k">Deposit + yield</span><span>{usdcStr(info.payout)}</span></div>
            <div className="line" style={{ marginTop: 6 }}><span className="k">Protocol fee</span><span>-{usdcStr(info.protocolFee)}</span></div>
            {viaRelayer && <div className="line" style={{ marginTop: 6 }}><span className="k">Gas fee</span><span>{!quote.data ? '…' : relayerFee === 0n ? 'Free' : `-${usdcStr(relayerFee)}`}</span></div>}
            <div className="line total" style={{ marginTop: 8 }}><span>You receive</span><span className="v">{usdcStr(receive)}</span></div>
          </div>
        )}
        <RecipientField id="wd-to" value={to} onChange={setTo} me={address} />

        <div className={`toggle${viaRelayer ? ' on' : ''}`}>
          <button onClick={() => setUseRelayer(!useRelayer)} disabled={!relayerAvailable} aria-pressed={viaRelayer}>
            <span>{relayerAvailable ? 'Submit through the Hushfund relayer (recommended: your wallet never appears)' : 'Relayer unavailable: the withdrawal will come from your wallet'}</span>
            <span className="sw" aria-hidden="true" />
          </button>
        </div>
        {!viaRelayer && <div className="warnbox">Without the relayer, the transaction is sent from your signed-in wallet. Anyone can then link this withdrawal to that wallet.</div>}

        {isConnected ? (
          <button className="primary" disabled={!ready} onClick={submit}>
            {info ? `Withdraw ${info.parsed.denomination.toLocaleString()} USDC` : 'Withdraw'}
          </button>
        ) : (
          <OpenfortButton label="Sign in to withdraw" />
        )}
      </section>

      <section className="card" style={{ ['--i' as string]: 1 }}>
        <Head title="What the chain sees" value={<p className="big">Private exit</p>} to="activity" onGo={go} />
        <div>
          <div className="src"><span className="rb"><Icon name="eye" size={15} /></span><div className="lbl"><b>Public</b><span>Merkle root, nullifier hash (stops a second withdrawal), recipient, relayer and fee, payout.</span></div></div>
          <div className="src"><span className="rb"><Icon name="eyeoff" size={15} /></span><div className="lbl"><b>Hidden</b><span>Which deposit is yours, the wallet that deposited it, and the exact time inside its yield bucket.</span></div></div>
          <div className="src"><span className="rb"><Icon name="shield" size={15} /></span><div className="lbl"><b>Proof</b><span>A Noir circuit proves you know a note in the tree. It is generated on your device; the contract only verifies it.</span></div></div>
          <div className="src"><span className="rb"><Icon name="drop" size={15} /></span><div className="lbl"><b>Gas</b><span>The Hushfund relayer sends the withdrawal and pays the Ethereum gas, so the receiving wallet needs no ETH.</span></div></div>
        </div>
      </section>
      <BridgeCard />
    </div>
  )
}
