import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Front Page" },
  { to: "/vote", label: "Cast a Ballot" },
  { to: "/ledger", label: "Public Ledger" },
  { to: "/verify", label: "Verify Receipt" },
  { to: "/admin", label: "Ballot of Record" },
] as const;

export function Masthead({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b-2 border-ink bg-paper sticky top-0 z-40">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* Top strip */}
        <div className="flex items-center justify-between py-2.5 text-sm">
          <div className="marginalia">No. 001 · Vol. MMXXVI</div>
          <div className="marginalia hidden md:block">Polls open · closes 14 Jul, 21:00 GMT</div>
          <div className="marginalia">Ivory Edition</div>
        </div>
        <div className="rule-hair" />

        {/* Masthead title */}
        {!compact ? (
          <div className="py-10 text-center">
            <div className="smallcaps text-sm text-ink-soft">The Herald Society</div>
            <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-tight mt-3">
              The <em className="italic font-normal">Ballot</em> Gazette
            </h1>
            <p className="mt-4 text-base text-ink-soft max-w-xl mx-auto">
              A private, verifiable election of record — cast, receipted, and independently recountable.
            </p>
          </div>
        ) : (
          <div className="py-5 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-baseline gap-3">
              <span className="font-display text-2xl md:text-3xl leading-none">
                The <em className="italic font-normal">Ballot</em> Gazette
              </span>
            </Link>
            <div className="hidden md:block marginalia">Polls close 14 Jul · 21:00 GMT</div>
          </div>
        )}

        <div className="rule-double" />

        {/* NAV — big tap targets, active underline */}
        <nav className="relative">
          {/* Desktop */}
          <div className="hidden md:flex items-center justify-center gap-1 py-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-5 py-4 text-base font-medium text-ink hover:text-stamp transition-colors"
                activeProps={{ className: "text-stamp font-semibold [&_.nav-underline]:opacity-100" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <span>{item.label}</span>
                <span className="nav-underline absolute left-3 right-3 -bottom-[2px] h-[3px] bg-stamp opacity-0" />
              </Link>
            ))}
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center justify-between py-3">
            <span className="marginalia">Sections</span>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="btn-ghost min-h-11 min-w-11 px-3"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
              <span className="smallcaps">{open ? "Close" : "Menu"}</span>
            </button>
          </div>
          {open && (
            <div className="md:hidden pb-4">
              <ul className="border-2 border-ink divide-y-2 divide-ink/20">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="block px-5 py-4 text-lg font-medium hover:bg-ink hover:text-paper transition-colors"
                      activeProps={{ className: "block px-5 py-4 text-lg font-semibold bg-stamp text-paper" }}
                      activeOptions={{ exact: item.to === "/" }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Colophon() {
  return (
    <footer className="mt-24 border-t-2 border-ink bg-paper-deep/40">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-12 grid gap-10 md:grid-cols-3">
        <div>
          <div className="smallcaps text-sm text-ink-soft mb-3">About</div>
          <p className="text-base leading-relaxed">
            Set in <em>Fraunces</em>, <em>Inter Tight</em>, and <em>JetBrains Mono</em>.
            No one can determine how a specific person voted; anyone can verify the count is correct.
          </p>
        </div>
        <div>
          <div className="smallcaps text-sm text-ink-soft mb-3">Cryptographic Notice</div>
          <p className="hash-mono">
            ballot_hash 0x9f3ac2b1…a8e0f2c
          </p>
          <p className="hash-mono mt-2">signing_key BLS-RSA 4096</p>
        </div>
        <div className="md:text-right">
          <div className="smallcaps text-sm text-ink-soft mb-3">Article 1</div>
          <p className="font-display italic text-lg leading-snug">
            &ldquo;The vote is a paper folded once and never opened again.&rdquo;
          </p>
        </div>
      </div>
      <div className="rule-hair mx-5 lg:mx-10" />
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-5 flex flex-wrap justify-between gap-3 marginalia">
        <span>© MMXXVI The Herald Society</span>
        <span>End of edition</span>
      </div>
    </footer>
  );
}
