import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Notes are the only key to a deposit. By default they live only in memory for this tab; the user can opt in
 * to keeping them in this browser (localStorage). Anyone with access to this browser profile could then read them,
 * so the UI always asks the user to keep their own backup as well.
 */
export type NoteStatus = 'active' | 'loan' | 'withdrawn' | 'renewed'

export interface StoredNote {
  note: string
  vault: `0x${string}`
  denomination: number // USDC
  createdAt: number // unix seconds
  commitment: `0x${string}`
  nullifierHash: `0x${string}`
  collateralNullifierHash: `0x${string}`
  yieldIndex: string
  status: NoteStatus
}

interface NotesCtx {
  notes: StoredNote[]
  persist: boolean
  setPersist: (on: boolean) => void
  add: (n: StoredNote) => void
  update: (commitment: string, patch: Partial<StoredNote>) => void
  remove: (commitment: string) => void
}

const KEY = 'hushfund.notes.v1'
const PERSIST_KEY = 'hushfund.notes.persist'
const Ctx = createContext<NotesCtx | null>(null)

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [persist, setPersistState] = useState<boolean>(() => read(PERSIST_KEY, false))
  const [notes, setNotes] = useState<StoredNote[]>(() => (read(PERSIST_KEY, false) ? read(KEY, []) : []))

  useEffect(() => {
    try {
      if (persist) localStorage.setItem(KEY, JSON.stringify(notes))
      else localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable: notes stay in memory */
    }
  }, [notes, persist])

  const setPersist = useCallback((on: boolean) => {
    setPersistState(on)
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(on))
    } catch {
      /* ignore */
    }
  }, [])

  const add = useCallback((n: StoredNote) => {
    setNotes((all) => (all.some((x) => x.commitment === n.commitment) ? all : [...all, n]))
  }, [])
  const update = useCallback((commitment: string, patch: Partial<StoredNote>) => {
    setNotes((all) => all.map((x) => (x.commitment === commitment ? { ...x, ...patch } : x)))
  }, [])
  const remove = useCallback((commitment: string) => {
    setNotes((all) => all.filter((x) => x.commitment !== commitment))
  }, [])

  const value = useMemo(() => ({ notes, persist, setPersist, add, update, remove }), [notes, persist, setPersist, add, update, remove])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotes() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNotes must be used inside NotesProvider')
  return v
}
