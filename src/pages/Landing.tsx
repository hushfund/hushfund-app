import { Icon, Logo, type IconName } from '../components/ui.tsx'
import { HashField } from '../components/HashField.tsx'

const FEATURES: [IconName, string, string][] = [
  ['shield', 'Zero-knowledge withdrawals', 'A proof made on your device shows you own a deposit without saying which one.'],
  ['layers', 'Yield while you wait', 'Deposits are allocated to Aave V3 and Morpho. Yield varies with protocol rates and is not guaranteed.'],
  ['coins', 'Borrow without withdrawing', 'Use a note as collateral for up to 70%. No liquidations; repaying gives you a fresh, unlinkable note.'],
  ['drop', 'Sponsored gas on Ethereum', 'Eligible deposits, withdrawals, loans and repayments can have their gas sponsored. Service availability and sponsorship budgets apply.'],
]

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="hf-landing">
      <HashField />
      <section className="hero">
        <Logo size={64} />
        <h1>
          Your money, <em>hushed</em>.
        </h1>
        <p>
          Hushfund is a private USDC vault on Ethereum Mainnet. Deposit, earn variable yield from Aave and Morpho, then withdraw or borrow using a private note and zero-knowledge proofs.
        </p>
        <div className="btns" style={{ maxWidth: 420 }}>
          <button className="primary" onClick={onLaunch}>Launch app</button>
        </div>
      </section>
      <section className="partners" aria-label="Yield sources">
        <span className="small">Yield from</span>
        <span className="partner"><img src="/partners/aave.png" alt="" width={28} height={28} />Aave V3</span>
        <span className="partner"><img src="/partners/morpho.png" alt="" width={28} height={28} />Morpho</span>
      </section>
      <section className="feat">
        {FEATURES.map(([icon, title, body], i) => (
          <article className="card" key={title} style={{ ['--i' as string]: i }}>
            <span className="rb"><Icon name={icon} size={15} /></span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
