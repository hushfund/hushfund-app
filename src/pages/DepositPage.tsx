import { useState } from 'react'
import { useAccount, useBalance, useEstimateFeesPerGas } from 'wagmi'
import { OpenfortButton } from '../components/SignInButton.tsx'
import { Head, useUi } from '../components/ui.tsx'
import { useActions } from '../hooks/useActions.ts'
import { useAllVaultStats, useApy, useAppConfig, useUsdcBalance } from '../hooks/useVaultData.ts'
import { fmt, money } from '../lib/format.ts'
import { CHAIN } from '../lib/env.ts'

/** Deposit gas budget (HushfundVault + Aave supply + Morpho deposit), with headroom. Validate before use. */
const DEPOSIT_GAS = 3_000_000n

export function DepositPage({ go }: { go: (to: string) => void }) {
  const { data: config } = useAppConfig()
  const { byVault } = useAllVaultStats(config)
  const { address, isConnected } = useAccount()
  const { balance } = useUsdcBalance(config?.usdc, address)
  const { deposit } = useActions(config)
  const { busy } = useUi()
  const vaults = config?.vaults ?? []
  const [picked, setPicked] = useState<number | null>(null)
  const vault = vaults.find((v) => v.denominationUsdc === picked) ?? vaults[0]
  const apy = useApy(vault?.address)
  const stats = vault ? byVault.get(vault.address.toLowerCase()) : undefined
  const enough = balance !== undefined && vault ? balance >= BigInt(vault.denominationUsdc) * 1_000_000n : false
  const eth = useBalance({ address, chainId: CHAIN.id, query: { refetchInterval: 20_000 } })
  const fees = useEstimateFeesPerGas({ chainId: CHAIN.id, query: { refetchInterval: 15_000 } })
  const gasWei = fees.data?.maxFeePerGas ? fees.data.maxFeePerGas * DEPOSIT_GAS : undefined
  const free = !!config?.sponsoredGas
  const enoughEth = free || (eth.data && gasWei !== undefined ? eth.data.value >= gasWei : true)

  return (
    <div className="pgrid">
      <section className="card" style={{ ['--i' as string]: 0 }}>
        <Head title="Deposit" value={<p className="big num">{money(vault?.denominationUsdc ?? 0)}</p>} />
        <p className="muted">
          Deposit <b>{vault?.denominationUsdc.toLocaleString() ?? '—'} USDC</b> into Hushfund. You will receive a secret note that can be used to withdraw or borrow later.
        </p>
        <div className="chips" role="group" aria-label="Vault size">
          {vaults.map((v) => (
            <button key={v.address} className={`chip${v === vault ? ' on' : ''}`} onClick={() => setPicked(v.denominationUsdc)}>
              {v.denominationUsdc.toLocaleString()} USDC
            </button>
          ))}
        </div>
        {isConnected && (
          <div className="row small">
            <span>
              Balance <b className="num" style={{ color: 'var(--fg)' }}>{balance === undefined ? '—' : fmt(Number(balance) / 1e6)} USDC</b>
            </span>
          </div>
        )}
        {isConnected && !free && (
          <div className="row small">
            <span>Estimated gas <b className="num" style={{ color: 'var(--fg)' }}>{gasWei === undefined ? '—' : `${fmt(Number(gasWei) / 1e18, 5)} ETH`}</b></span>
            <span>ETH balance <b className="num" style={{ color: 'var(--fg)' }}>{eth.data ? fmt(Number(eth.data.value) / 1e18, 5) : '—'}</b></span>
          </div>
        )}
        {isConnected && !enoughEth && <div className="warnbox">Not enough ETH for gas. Add some ETH to this wallet to deposit.</div>}
        {stats?.paused && <div className="warnbox">Deposits are paused on this vault right now. Withdrawals and repayments still work.</div>}
        {free && <div className="yieldbox"><span className="pdot" />Gas-free: Hushfund pays the Ethereum gas for this deposit</div>}
        <div className="yieldbox">
          <span className="pdot" />
          Earns Aave + Morpho yield while deposited{apy.data?.blended != null ? ` · about ${apy.data.blended.toFixed(2)}% APY` : ''}
          {apy.data?.status !== 'available' && apy.data?.message && <span style={{ display: 'block', marginTop: 8 }}>{apy.data.message}</span>}
        </div>
        <p className="small" style={{ margin: 0 }}>
          A note earns from the next yield bucket (about a day). Withdrawing sooner returns slightly less than the deposit.
        </p>
        {isConnected ? (
          <button className="primary" disabled={!vault || !enough || !enoughEth || busy || stats?.paused} onClick={() => vault && deposit(vault)}>
            {enough || balance === undefined ? `Deposit ${vault?.denominationUsdc.toLocaleString() ?? ''} USDC` : 'Not enough USDC'}
          </button>
        ) : (
          <OpenfortButton label="Sign in to deposit" />
        )}
      </section>

      <section className="card" style={{ ['--i' as string]: 1 }}>
        <Head title="How a deposit works" value={<p className="big num">{stats?.deposits ?? '—'}<span className="unit"> deposits in this vault</span></p>} to="dashboard" onGo={go} />
        <ol className="how">
          <li><b>Secret note</b><span>Your browser creates a random nullifier and secret. Only you hold them.</span></li>
          <li><b>One signature, no gas</b><span>You sign a USDC authorization (EIP-3009) tied to this exact note, so nobody can redirect it. The Hushfund relayer submits it and pays the Ethereum gas.</span></li>
          <li><b>Commitment</b><span>The vault hashes your note with the current yield index (Poseidon2) and adds it to a Merkle tree of up to a million deposits.</span></li>
          <li><b>Yield</b><span>The USDC goes into Aave V3 and a Morpho vault and earns from the moment it lands.</span></li>
        </ol>
      </section>
    </div>
  )
}
