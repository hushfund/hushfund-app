import { EXPLORER } from '../lib/env.ts'
import { fmt, shortHex } from '../lib/format.ts'
import { useUi } from './ui.tsx'

export function DoneCard({ title, amount, to, txHash, warning }: { title: string; amount?: bigint; to: string; txHash: string; warning?: string }) {
  const { closeModal } = useUi()
  return (
    <>
      <h3>{title}</h3>
      <div className="detail num">
        {amount !== undefined && <div className="line"><span className="k">Amount</span><span>{fmt(Number(amount) / 1e6, 4)} USDC</span></div>}
        <div className="line"><span className="k">To</span><span className="mono">{shortHex(to)}</span></div>
        <div className="line">
          <span className="k">Transaction</span>
          <a className="txlink" href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">{shortHex(txHash, 8, 6)}</a>
        </div>
      </div>
      {warning && <div className="warnbox" style={{ wordBreak: 'break-all' }}>{warning}</div>}
      <button className="primary" onClick={closeModal}>Done</button>
    </>
  )
}
