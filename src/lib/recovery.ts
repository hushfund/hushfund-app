/** Recovery secrets never leave the browser. Only encrypted backups may be persisted. */
export interface RecoveryDraft {
  version: 1
  chainId: 1
  action: 'deposit' | 'repay'
  vault: `0x${string}`
  denomination: number
  draftNote: string
  replaces?: string
  createdAt: number
}
export interface EncryptedRecovery {
  format: 'hushfund-recovery-v1'
  salt: number[]
  iv: number[]
  ciphertext: number[]
}
const encoder = new TextEncoder()
async function key(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as Uint8Array<ArrayBuffer>, iterations: 250_000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}
export async function encryptRecovery(draft: RecoveryDraft, password: string): Promise<EncryptedRecovery> {
  if (password.length < 12) throw new Error('Use a recovery password of at least 12 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt), encoder.encode(JSON.stringify(draft)))
  return { format: 'hushfund-recovery-v1', salt: [...salt], iv: [...iv], ciphertext: [...new Uint8Array(ciphertext)] }
}
export async function decryptRecovery(value: unknown, password: string): Promise<RecoveryDraft> {
  const b = value as EncryptedRecovery
  const bytes = (v: unknown, length?: number): v is number[] => Array.isArray(v) && (!length || v.length === length) && v.every(n => Number.isInteger(n) && n >= 0 && n < 256)
  if (b?.format !== 'hushfund-recovery-v1' || !bytes(b.salt, 16) || !bytes(b.iv, 12) || !bytes(b.ciphertext) || b.ciphertext.length > 16_384) throw new Error('Invalid recovery backup.')
  let draft: RecoveryDraft
  try {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b.iv) }, await key(password, new Uint8Array(b.salt)), new Uint8Array(b.ciphertext))
    draft = JSON.parse(new TextDecoder().decode(data))
  } catch { throw new Error('Cannot unlock this backup. Check the file and recovery password.') }
  if (!draft || draft.version !== 1 || draft.chainId !== 1 || !['deposit', 'repay'].includes(draft.action) ||
    !/^0x[0-9a-fA-F]{40}$/.test(draft.vault) || ![10, 50, 100, 1000].includes(draft.denomination) ||
    typeof draft.draftNote !== 'string' || !new RegExp(`^hushfund-usdc-${draft.denomination}-ethereum-[0-9a-fA-F]{256}$`).test(draft.draftNote) ||
    !Number.isFinite(draft.createdAt) || (draft.replaces !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(draft.replaces))) throw new Error('This backup is not a valid Ethereum Mainnet note.')
  return draft
}
export function downloadRecovery(backup: EncryptedRecovery) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'hushfund-recovery.json'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function journalKey(note: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(note)))
  return 'hushfund.recovery.tx.' + [...digest].map(b => b.toString(16).padStart(2, '0')).join('')
}
/** Persist public status only, never the note, recovery password, or decryption key. */
export async function recordRecoveryTransaction(note: string, hash: `0x${string}`): Promise<boolean> {
  try { localStorage.setItem(await journalKey(note), hash); return true }
  catch { return false }
}
export async function recoveryTransaction(note: string): Promise<`0x${string}` | undefined> {
  try {
    const hash = localStorage.getItem(await journalKey(note))
    return hash && /^0x[0-9a-fA-F]{64}$/.test(hash) ? hash as `0x${string}` : undefined
  } catch { return undefined }
}
