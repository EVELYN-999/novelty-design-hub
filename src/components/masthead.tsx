import { Link } from "@tanstack/react-router";

export function Masthead({ compact = false }: { compact?: boolean }) {
  return (
    <header className="w-full border-b-2 border-ink bg-paper">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="flex items-center justify-between py-3">
          <div className="marginalia">No. 001 · Vol. MMXXVI · Sealed Record</div>
          <div className="marginalia hidden md:block">
            Ballot hash 0x9f3a…f2c · Locked 05 Jul 18:42
          </div>
          <div className="marginalia">Ivory Edition</div>
        </div>
        <div className="rule-hair" />
        {!compact && (
          <div className="py-8 text-center">
            <div className="smallcaps text-xs text-ink-soft">The Herald Society</div>
            <h1 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.9] tracking-tight mt-2">
              The <em className="italic font-normal">Ballot</em> Gazette
            </h1>
            <div className="mt-3 flex items-center justify-center gap-3 marginalia">
              <span>Annual General Election</span>
              <span>·</span>
              <span>Est. 1974</span>
              <span>·</span>
              <span>Privacy is a right, not a favour</span>
            </div>
          </div>
        )}
        <div className="rule-double" />
        <nav className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-6">
            <NavItem to="/">Front Page</NavItem>
            <NavItem to="/vote">Cast a Ballot</NavItem>
            <NavItem to="/ledger">Public Ledger</NavItem>
            <NavItem to="/verify">Verify a Receipt</NavItem>
            <NavItem to="/admin">Ballot of Record</NavItem>
          </div>
          <div className="marginalia hidden md:block">
            Polls open until 14 Jul · 21:00 GMT
          </div>
        </nav>
        <div className="rule-hair" />
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="smallcaps text-[0.72rem] text-ink hover:text-stamp transition-colors"
      activeProps={{ className: "text-stamp" }}
    >
      {children}
    </Link>
  );
}

export function Colophon() {
  return (
    <footer className="mt-20 border-t-2 border-ink">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="smallcaps text-xs text-ink-soft mb-2">Colophon</div>
          <p className="text-sm leading-relaxed">
            Set in <em>Fraunces</em>, <em>Inter Tight</em>, and <em>JetBrains Mono</em>.
            Printed digitally on ivory stock. No one can determine how a specific
            person voted; anyone can verify the count is correct.
          </p>
        </div>
        <div>
          <div className="smallcaps text-xs text-ink-soft mb-2">Cryptographic Notice</div>
          <p className="hash-mono">
            ballot_hash 0x9f3ac2b1e8d47c50a1b6f9d2c7e83b04a12f7e6d5b8c9a0e3f1d2c4b6a8e0f2c
          </p>
          <p className="hash-mono mt-1">signing_key BLS-RSA 4096 · 3A:F2:9C:81:B0:44:E7:29</p>
        </div>
        <div className="text-right">
          <div className="smallcaps text-xs text-ink-soft mb-2">Article 1</div>
          <p className="font-display italic text-lg leading-snug">
            &ldquo;The vote is a paper folded once and never opened again in the
            presence of its bearer.&rdquo;
          </p>
        </div>
      </div>
      <div className="rule-hair mx-6 lg:mx-10" />
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-4 flex justify-between marginalia">
        <span>© MMXXVI The Herald Society</span>
        <span>End of edition</span>
      </div>
    </footer>
  );
}
