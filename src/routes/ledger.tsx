import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { LEDGER, ELECTION, TALLY } from "@/lib/election-data";

export const Route = createFileRoute("/ledger")({
  component: LedgerPage,
  head: () => ({
    meta: [
      { title: "Public Ledger — The Ballot Gazette" },
      { name: "description", content: "Every ballot cast in the Annual Election, appended in an append-only hash chain. Read, download, and verify." },
    ],
  }),
});

function LedgerPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen">
      <Masthead compact />

      <main className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <div className="py-10 border-b-2 border-ink">
          <div className="marginalia">Public Ledger</div>
          <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
            A hash-chain of <em className="italic">every ballot</em>.
          </h2>
          <p className="mt-3 text-lg text-ink-soft max-w-2xl">
            Ordered by arrival. Each entry links to the previous by hash — silently rewriting the past breaks the chain.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 max-w-md">
            <SummaryStat n={LEDGER.length.toString()} l="Entries" />
            <SummaryStat n="3" l="Positions" />
            <SummaryStat n="0" l="Breaks" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 py-10">
          {/* Sidebar with tally */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <div className="border-2 border-ink p-5 bg-card">
              <div className="marginalia">Live tally</div>
              <div className="mt-4 space-y-6">
                {Object.entries(TALLY).map(([pos, rows]) => (
                  <div key={pos}>
                    <div className="smallcaps text-sm text-ink border-b border-ink/25 pb-1 mb-3">{pos}</div>
                    <ul className="space-y-3">
                      {rows.map((r, i) => {
                        const max = rows[0].votes;
                        const pct = (r.votes / max) * 100;
                        const leader = i === 0;
                        return (
                          <li key={r.candidate}>
                            <div className="flex justify-between text-base mb-1.5">
                              <span className={leader ? "font-semibold" : "text-ink-soft"}>
                                {leader && <span className="text-stamp mr-1">▸</span>}
                                {r.candidate}
                              </span>
                              <span className="font-mono font-semibold">{r.votes}</span>
                            </div>
                            <div className="h-2 bg-ink/10 relative">
                              <div
                                className={`absolute inset-y-0 left-0 ${leader ? "bg-stamp" : "bg-ink/50"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-ink/30 p-5">
              <div className="marginalia mb-3">Chain root</div>
              <p className="hash-mono">{ELECTION.ballot_hash}</p>
              <div className="rule-hair my-4" />
              <div className="marginalia mb-2">Downloads</div>
              <ul className="space-y-2">
                {["ledger.jsonl", "merkle-roots.txt", "recount.py"].map(f => (
                  <li key={f}>
                    <a href="#" className="inline-flex items-center gap-2 ink-link text-base">
                      <Download size={16} /> {f}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Ledger entries */}
          <section className="col-span-12 lg:col-span-8">
            <div className="marginalia mb-3">Entries · newest first at top of chain grows downward</div>
            <ol className="space-y-3">
              {LEDGER.map((e, i) => {
                const open = openIdx === i;
                return (
                  <li key={e.index}>
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      aria-expanded={open}
                      className={`w-full text-left border-2 transition-colors ${
                        open ? "border-stamp bg-card" : "border-ink/25 hover:border-ink bg-card"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-4 p-4">
                        <div className="font-display text-2xl text-stamp w-14 shrink-0">
                          #{String(e.index).padStart(3, "0")}
                        </div>
                        <div className="marginalia w-40 shrink-0">{e.timestamp}</div>
                        <div className="hash-mono flex-1 min-w-0 truncate">{e.hash}</div>
                        <div className="ml-auto">
                          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="mt-2 border-l-4 border-stamp bg-card/50 pl-5 pr-4 py-5 space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="marginalia">Previous hash</div>
                            <p className="hash-mono mt-1">{e.prev_hash}</p>
                          </div>
                          <div>
                            <div className="marginalia">Anonymous token</div>
                            <p className="hash-mono mt-1">{e.token}…</p>
                          </div>
                        </div>
                        <div>
                          <div className="marginalia mb-2">Selections</div>
                          <dl className="grid gap-4 sm:grid-cols-3">
                            {e.selections.map(s => (
                              <div key={s.position} className="border-l-2 border-ink/25 pl-3">
                                <dt className="text-sm text-ink-soft">{s.position}</dt>
                                <dd className="font-display text-lg mt-0.5">{s.candidate}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              {/* Genesis */}
              <li className="border-2 border-dashed border-ink/40 p-4 mt-4">
                <div className="marginalia">Genesis · Ballot locked</div>
                <p className="hash-mono mt-2">{ELECTION.ballot_hash}</p>
                <p className="text-base text-ink-soft mt-1">{ELECTION.ballot_locked_at}</p>
              </li>
            </ol>
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}

function SummaryStat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-3xl">{n}</div>
      <div className="marginalia mt-1">{l}</div>
    </div>
  );
}
