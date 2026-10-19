import { useState } from 'react'
import { decryptRecovery, recoveryTransaction } from '../lib/recovery.ts'
import { api, type AppConfig } from '../lib/api.ts'
import { decodeNote, encodeNote } from '../zk/note.ts'
import { hexToBytes } from '../zk/utils.ts'
import { noteHashes } from '../zk/proof.ts'
import { useNotes } from '../hooks/useNotes.tsx'
import { NoteModal, useUi } from './ui.tsx'
import { publicClient } from '../lib/client.ts'

export function RecoverNote({ config }: { config: AppConfig | undefined }) {
  const [file, setFile] = useState<File>()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const notes = useNotes()
  const { openModal } = useUi()
  return <section className="card">
    <h3>Recover a pending note</h3>
    <p className="small">Upload the encrypted backup saved before your deposit or repayment. Recovery checks confirmed vault deposits; it never sends a transaction. Anyone with your file and password can recover the note.</p>
    <label htmlFor="recover-file">Encrypted recovery file</label>
    <input className="inp" id="recover-file" type="file" accept=".json,application/json" onChange={e => setFile(e.target.files?.[0])} />
    <label htmlFor="recover-password">Recovery password</label>
    <input className="inp" id="recover-password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} />
    {error && <p className="err" role="alert">{error}</p>}
    <button className="primary" disabled={busy || !file || !password || !config} onClick={async () => {
      setBusy(true); setError('')
      try {
        if (!file || file.size > 100_000) throw new Error('Choose a recovery file smaller than 100 KB.')
        const draft = await decryptRecovery(JSON.parse(await file.text()), password)
        if (!config?.vaults.some(v => v.address.toLowerCase() === draft.vault.toLowerCase() && v.denominationUsdc === draft.denomination)) throw new Error('This vault is not part of the current Mainnet deployment.')
        const hash = await recoveryTransaction(draft.draftNote)
        let receiptMissing = false
        if (hash) {
          try {
            const receipt = await publicClient.getTransactionReceipt({ hash })
            if (receipt.status === 'reverted') throw new Error('The recorded transaction reverted. It did not create a new note; the original note remains unchanged.')
          } catch (e) {
            // A repriced transaction has a new hash. A matching confirmed
            // commitment remains authoritative even without the original receipt.
            if (e instanceof Error && e.name === 'TransactionReceiptNotFoundError') receiptMissing = true
            else throw e
          }
        }
        const stats = await api.stats(draft.vault)
        const n = decodeNote(draft.draftNote)
        for (const yieldIndex of new Set(stats.leaves.map(l => l.yieldIndex))) {
          const raw = encodeNote(n.commitment, n.nullifier, n.secret, hexToBytes('0x' + BigInt(yieldIndex).toString(16).padStart(64, '0')), 'usdc', draft.denomination, 'ethereum')
          const h = await noteHashes(decodeNote(raw))
          if (!stats.leaves.some(l => l.commitment.toLowerCase() === h.commitment.toLowerCase())) continue
          notes.add({ note: raw, vault: draft.vault, denomination: draft.denomination, createdAt: draft.createdAt, ...h, yieldIndex: yieldIndex, status: 'active' })
          if (draft.replaces) notes.update(draft.replaces, { status: 'renewed' })
          setPassword('')
          openModal(<NoteModal title="Note recovered" note={raw} intro="Save this completed note. Your encrypted recovery backup also remains usable." />)
          return
        }
        throw new Error(receiptMissing
          ? 'No confirmed deposit matches this backup yet. The recorded transaction is pending, replaced, or not found. Check your wallet and wait for confirmation. Do not send it again.'
          : 'No confirmed deposit matches this backup yet. If the transaction is still pending, try again after confirmation. Do not send it again just to recover a note.')
      } catch (e) { setError(e instanceof Error ? e.message : 'Recovery failed. Your file has not been changed.') }
      finally { setBusy(false) }
    }}>{busy ? 'Checking confirmed deposits…' : 'Recover note'}</button>
  </section>
}
