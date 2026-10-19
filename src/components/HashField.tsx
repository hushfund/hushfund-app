import { useEffect, useMemo, useRef, useState } from 'react'
import './hash-field.css'

/* Decorative only: pseudo-random hex strings, never real addresses or tx data. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const HEX = '0123456789abcdef'
const columnCount = () => typeof window === 'undefined' ? 14 : window.innerWidth < 700 ? 6 : window.innerWidth < 1100 ? 10 : 14

export function HashField() {
  const ref = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(columnCount)
  const [rowCount, setRowCount] = useState(48)

  useEffect(() => {
    const onResize = () => {
      setCols(columnCount())
      // Each duplicated strip must fill the backdrop even at the loop boundary.
      setRowCount(Math.max(28, Math.ceil((ref.current?.clientHeight ?? 600) / 22) + 2))
    }
    const onVis = () => ref.current?.classList.toggle('paused', document.hidden)
    const observer = new ResizeObserver(onResize)
    if (ref.current) observer.observe(ref.current)
    onResize()
    onVis()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      observer.disconnect()
    }
  }, [])

  const data = useMemo(() => {
    const r = seeded(0x5eed + cols)
    return Array.from({ length: cols }, (_, c) => {
      const rows = Array.from({ length: rowCount }, () => {
        let h = '0x'
        for (let k = 0; k < 8; k++) h += HEX[Math.floor(r() * 16)]
        return h
      })
      return {
        rows,
        dur: 38 + r() * 50,
        delay: -r() * 60,
        dir: r() > 0.7 ? 'reverse' : 'normal',
        op: 0.35 + r() * 0.65,
        key: c,
      }
    })
  }, [cols, rowCount])

  return (
    <div className="hashfield" ref={ref} aria-hidden="true">
      <div className="hf-cols" style={{ ['--cols' as string]: cols }}>
        {data.map((col) => (
          <div className="hf-col" key={col.key} style={{ opacity: col.op }}>
            <div
              className="hf-track"
              style={{ animationDuration: `${col.dur}s`, animationDelay: `${col.delay}s`, animationDirection: col.dir }}
            >
              {[0, 1].map((dup) => (
                <div key={dup}>
                  {col.rows.map((h, i) => <span key={i}>{h}</span>)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="hf-shade" />
    </div>
  )
}
