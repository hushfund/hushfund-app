import { useQuery } from '@tanstack/react-query'
import { Head, Icon, useUi } from '../components/ui.tsx'
import { useNotes, type StoredNote } from '../hooks/useNotes.tsx'
import { useAllVaultStats, useAppConfig } from '../hooks/useVaultData.ts'
import { vaultAbi } from '../contracts/vaultAbi.ts'
import { publicClient } from '../lib/client.ts'
import { ago, money } from '../lib/format.ts'
import { RecoverNote } from '../components/RecoverNote.tsx'

/** Re-reads each note's on-chain state so the list stays correct even if it was used elsewhere. */
function useLiveStatus(notes: StoredNote[]) {
  return useQuery({
    queryKey: ['noteStatus', notes.map((n) => n.commitment).join()],
    enabled: notes.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const out = new Map<string, StoredNote['status']>()
      await Promise.all(
        notes.map(async (n) => {
          const [spent, loan] = await Promise.all([
            publicClient.readContract({ address: n.vault, abi: vaultAbi, functionName: 's_nullifierHashes', args: [n.nullifierHash] }),
            publicClient.readContract({ address: n.vault, abi: vaultAbi, functionName: 's_loans', args: [n.collateralNullifierHash] }),
          ])
          out.set(n.commitment, spent ? (n.status === 'renewed' ? 'renewed' : 'withdrawn') : (loan as readonly unknown[])[3] ? 'loan' : 'active')
        }),
      )
      return out
    },
  })
}

const LABEL: Record<StoredNote['status'], [string, string]> = {
  active: ['st-in', 'In vault'],
  loan: ['st-loan', 'Loan active'],
  withdrawn: ['st-out', 'Withdrawn'],
  renewed: ['st-out', 'Renewed'],
}

export function NotesPage({ go }: { go: (to: string, note?: string) => void }) {
  const { notes, persist, setPersist, remove } = useNotes()
  const { data: config } = useAppConfig()
  const { byVault } = useAllVaultStats(config)
  const live = useLiveStatus(notes)
  const { toast } = useUi()

  if (!notes.length) {
    return (
      <><RecoverNote config={config} /><section className="card" style={{ ['--i' as string]: 0 }}>
        <Head title="My Notes" value={<p className="big num">0<span className="unit"> notes</span></p>} />
        <div className="empty">
          <Icon name="note" size={28} />
          <p style={{ margin: 0, maxWidth: '40ch' }}>
            No notes in this browser. Notes from your deposits appear here; a note you saved elsewhere can be pasted on the Withdraw or Borrow page.
          </p>
          <button className="ghost" onClick={() => go('deposit')}><Icon name="in" size={15} />Make a deposit</button>
        </div>
      </section></>
    )
  }

  return (
    <>
      <RecoverNote config={config} />
      <div className="chiprow" style={{ ['--i' as string]: 0 }}>
        <p className="small" style={{ margin: 0 }}>
          {persist ? 'Notes are remembered in this browser. Keep your own backup too.' : 'Notes are kept only until you close this tab.'}
        </p>
        <button className="ffb" onClick={() => setPersist(!persist)}>{persist ? 'Forget on close' : 'Remember in this browser'}</button>
      </div>
      <div className="ngrid">
        {[...notes].reverse().map((n, k) => {
          const status = live.data?.get(n.commitment) ?? n.status
          const st = byVault.get(n.vault.toLowerCase())
          const value = st ? (n.denomination * Number((BigInt(st.yieldIndex) * 1_000_000n) / BigInt(n.yieldIndex))) / 1e6 : n.denomination
          const usable = status === 'active' || status === 'loan'
          return (
            <section className="card" key={n.commitment} style={{ ['--i' as string]: k + 1 }}>
              <Head title={`${n.denomination.toLocaleString()} USDC note`} value={<p className="big num">{usable ? money(value, 4) : '—'}</p>} />
              <div className="row">
                <span className={`status ${LABEL[status][0]}`}>{LABEL[status][1]}</span>
                <span className="small">Deposited {ago(n.createdAt)}</span>
              </div>
              <p className="mono" style={{ margin: 0, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.note.slice(0, 48)}…</p>
              <div className="btns">
                {usable && <button className="mini" onClick={() => go('withdraw', n.note)} disabled={status === 'loan'}>Withdraw</button>}
                {usable && <button className="mini" onClick={() => go('borrow', n.note)}>{status === 'loan' ? 'Repay' : 'Borrow'}</button>}
                <button className="mini" onClick={async () => {
                  try { await navigator.clipboard.writeText(n.note); toast('Note copied') } catch { toast('Copy blocked: select the note text instead') }
                }}>Copy</button>
                {!usable && <button className="mini" onClick={() => remove(n.commitment)}>Forget</button>}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
