import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Radio } from "lucide-react";

const NAV = [
  { to: "/", label: "00 · Overview" },
  { to: "/vote", label: "01 · Cast Ballot" },
  { to: "/ledger", label: "02 · Public Ledger" },
  { to: "/verify", label: "03 · Verify" },
  { to: "/admin", label: "04 · Admin" },
] as const;

export function Masthead({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b border-line bg-bg sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px]">
        {/* Ticker strip */}
        <div className="flex items-stretch border-b border-line-dim">
          <div className="flex items-center gap-2 px-4 py-1.5 border-r border-line-dim">
            <Radio size={12} className="text-accent animate-pulse" />
            <span className="label-on">Live</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="ticker whitespace-nowrap py-1.5 label flex gap-8 pl-4">
              <span>System: nominal</span><span>·</span>
              <span>Chain integrity: verified</span><span>·</span>
              <span>Blind-signature protocol: BLS-RSA 4096</span><span>·</span>
              <span>Election of Record MMXXVI</span><span>·</span>
              <span>Node Assembly</span><span>·</span>
              <span>System: nominal</span><span>·</span>
              <span>Chain integrity: verified</span><span>·</span>
              <span>Blind-signature protocol: BLS-RSA 4096</span><span>·</span>
              <span>Election of Record MMXXVI</span><span>·</span>
              <span>Node Assembly</span>
            </div>
          </div>
          <div className="hidden md:block px-4 py-1.5 border-l border-line-dim label">
            v.2026.7
          </div>
        </div>

        {/* Wordmark */}
        <div className="px-5 lg:px-10">
          {compact ? (
            <div className="py-5 flex items-center justify-between gap-4">
              <Link to="/" className="flex items-baseline gap-4">
                <span className="mono text-accent text-xl font-bold">◼</span>
                <span className="font-display text-2xl md:text-3xl font-black tracking-tight leading-none">
                  ELECTION<span className="text-accent">/</span>NODE
                </span>
              </Link>
              <div className="hidden md:block label">Poll open · closes 14 · 07 · 2026 · 21:00 UTC</div>
            </div>
          ) : (
            <div className="py-10 md:py-14">
              <div className="flex items-baseline gap-3">
                <span className="mono text-accent text-xl">◼</span>
                <span className="label-on">Bulletin 001 / MMXXVI</span>
              </div>
              <h1 className="mt-3 font-display font-black leading-[0.9] tracking-[-0.03em]
                             text-[clamp(3rem,10vw,7rem)]">
                ELECTION<span className="text-accent">/</span>NODE
              </h1>
              <p className="mt-5 max-w-2xl text-fg-dim text-base md:text-lg leading-relaxed">
                A high-integrity, blind-signature ballot with a public hash-chained ledger.
                Nobody can determine <em className="text-fg">how</em> a voter voted; anyone can prove
                <em className="text-fg"> that</em> every vote was counted.
              </p>
            </div>
          )}
        </div>

        {/* NAV */}
        <nav className="border-t border-line px-5 lg:px-10">
          <div className="hidden md:flex items-stretch">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-5 py-4 label border-r border-line-dim hover:text-accent hover:bg-bg-2 transition-colors"
                activeProps={{ className: "text-accent bg-bg-2 border-b border-b-accent -mb-px" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="md:hidden flex items-center justify-between py-3">
            <span className="label">Sections</span>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="btn"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
              {open ? "Close" : "Menu"}
            </button>
          </div>
          {open && (
            <ul className="md:hidden border-t border-line pb-3">
              {NAV.map((item) => (
                <li key={item.to} className="border-b border-line-dim">
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block px-2 py-4 label hover:text-accent"
                    activeProps={{ className: "block px-2 py-4 label-on" }}
                    activeOptions={{ exact: item.to === "/" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Colophon() {
  return (
    <footer className="mt-24 border-t border-line bg-bg">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-baseline gap-3">
            <span className="mono text-accent">◼</span>
            <span className="font-display font-black text-2xl tracking-tight">
              ELECTION<span className="text-accent">/</span>NODE
            </span>
          </div>
          <p className="mt-4 text-fg-dim text-sm leading-relaxed max-w-md">
            An open, hash-chained election of record.
            Set in <span className="text-fg">Inter</span> and <span className="text-fg mono">JetBrains Mono</span>.
          </p>
        </div>
        <div>
          <div className="label mb-3">Protocol</div>
          <p className="hash">SHA-256 · BLS-RSA 4096</p>
          <p className="hash mt-2">Chain: append-only, hash-linked</p>
        </div>
        <div>
          <div className="label mb-3">Bulletin</div>
          <p className="hash">MMXXVI · issue 001</p>
          <p className="hash mt-2">© Node Assembly</p>
        </div>
      </div>
      <div className="border-t border-line-dim mx-5 lg:mx-10" />
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-4 flex flex-wrap justify-between label">
        <span>End of transmission</span>
        <span>◼ ◼ ◼</span>
      </div>
    </footer>
  );
}
