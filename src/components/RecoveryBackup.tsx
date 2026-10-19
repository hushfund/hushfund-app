import { useState } from 'react'
import { downloadRecovery, encryptRecovery, type RecoveryDraft } from '../lib/recovery.ts'

export function RecoveryBackup({ draft, onContinue, onCancel }: { draft: RecoveryDraft; onContinue: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  return <>
    <h3>Back up before sending</h3>
    <p className="small">Your recovery file protects this {draft.action === 'repay' ? 'renewed note' : 'deposit'} if the tab closes while the transaction confirms. Keep the file and its password safe. Hushfund cannot recover either for you.</p>
    <label htmlFor="recovery-password">Recovery password (12+ characters)</label>
    <input className="inp" id="recovery-password" type="password" autoComplete="new-password" value={password} disabled={saved} onChange={e => setPassword(e.target.value)} />
    <label htmlFor="recovery-repeat">Repeat recovery password</label>
    <input className="inp" id="recovery-repeat" type="password" autoComplete="new-password" value={repeat} disabled={saved} onChange={e => setRepeat(e.target.value)} />
    {error && <p className="err" role="alert">{error}</p>}
    <button className="primary" disabled={working || saved || password.length < 12 || password !== repeat} onClick={async () => {
      setWorking(true)
      try { downloadRecovery(await encryptRecovery(draft, password)); setSaved(true) }
      catch { setError('Backup could not be created. No transaction has been sent.') }
      finally { setWorking(false) }
    }}>{saved ? 'Recovery file downloaded' : working ? 'Encrypting backup…' : 'Download encrypted recovery file'}</button>
    <label className="check"><input type="checkbox" disabled={!saved} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have saved the file and its password separately.</label>
    <button className="primary" disabled={!saved || !confirmed} onClick={onContinue}>Continue to transaction</button>
    <button className="mini" disabled={working} onClick={onCancel}>Cancel — do not send</button>
    <p className="small">After a refresh, open My Notes → Recover a pending note and upload this file. Only a public transaction hash is kept in this browser. No note secrets or recovery passwords are sent to the server.</p>
  </>
}
