import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  const total = LEDGER.length;

  return (
    <div className="min-h-screen">
      <Masthead compact />

      <main className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="py-8 grid grid-cols-12 gap-8 items-end border-b-2 border-ink">
          <div className="col-span-12 md:col-span-8">
            <div className="marginalia">Section · Public Ledger</div>
            <h2 className="mt-2 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.95]">
              A hash-chain of <em className="italic">every ballot</em>, in order of arrival.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 grid grid-cols-3 gap-4 text-right">
            <div>
              <div className="font-display text-3xl">{total}</div>
              <div className="marginalia">Entries</div>
            </div>
            <div>
              <div className="font-display text-3xl">3</div>
              <div className="marginalia">Positions</div>
            </div>
            <div>
              <div className="font-display text-3xl">0</div>
              <div className="marginalia">Breaks</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 py-10">
          <aside className="col-span-12 md:col-span-3 md:sticky md:top-6 self-start space-y-6">
            <div className="border-2 border-ink p-5">
              <div className="marginalia">Chain Root</div>
              <p className="hash-mono mt-2">{ELECTION.ballot_hash}</p>
              <div className="rule-hair my-4" />
              <div className="marginalia">Signing key</div>
              <p className="hash-mono mt-1">{ELECTION.signing_key_fp}</p>
            </div>

            <div className="border-2 border-ink/40 p-5">
              <div className="marginalia">Live tally</div>
              <div className="mt-3 space-y-4">
                {Object.entries(TALLY).map(([pos, rows]) => (
                  <div key={pos}>
                    <div className="smallcaps text-xs text-ink-soft">{pos}</div>
                    <ul className="mt-2 space-y-1.5">
                      {rows.map((r, i) => {
                        const max = rows[0].votes;
                        const pct = (r.votes / max) * 100;
                        return (
                          <li key={r.candidate}>
                            <div className="flex justify-between text-sm">
                              <span className={i === 0 ? "font-display" : "text-ink-soft"}>{r.candidate}</span>
                              <span className="hash-mono">{r.votes}</span>
                            </div>
                            <div className="h-[3px] mt-1 bg-ink/10 relative">
                              <div
                                className={`absolute inset-y-0 left-0 ${i === 0 ? "bg-stamp" : "bg-ink/40"}`}
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

            <div className="border-2 border-ink/40 p-5">
              <div className="marginalia">Download</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a className="ink-link" href="#">ledger.jsonl</a></li>
                <li><a className="ink-link" href="#">merkle-roots.txt</a></li>
                <li><a className="ink-link" href="#">recount.py</a></li>
              </ul>
            </div>
          </aside>

          <section className="col-span-12 md:col-span-9">
            <div className="rule-hair mb-4" />
            <ol className="relative">
              <div className="absolute left-[13px] top-3 bottom-3 w-px bg-ink/25" />
              {LEDGER.map((e, i) => {
                const open = openIdx === i;
                return (
                  <li key={e.index} className="relative pl-10 pb-5">
                    <span className={`absolute left-2 top-3 h-4 w-4 border-2 border-ink ${open ? "bg-stamp border-stamp" : "bg-paper"}`} />
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      className={`w-full text-left border-2 transition-colors ${
                        open ? "border-ink bg-card" : "border-ink/20 hover:border-ink"
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-4 p-4 items-center">
                        <div className="col-span-1 font-display text-2xl text-ink-soft">
                          #{String(e.index).padStart(3, "0")}
                        </div>
                        <div className="col-span-3 marginalia">{e.timestamp}</div>
                        <div className="col-span-6 hash-mono truncate">{e.hash}</div>
                        <div className="col-span-2 text-right marginalia">
                          {open ? "▲ close" : "▼ open"}
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="mt-2 border-l-2 border-stamp pl-6 py-4 space-y-4">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-12 md:col-span-6">
                            <div className="marginalia">Previous hash</div>
                            <p className="hash-mono mt-1">{e.prev_hash}</p>
                          </div>
                          <div className="col-span-12 md:col-span-6">
                            <div className="marginalia">Anonymous token (truncated)</div>
                            <p className="hash-mono mt-1">{e.token}…</p>
                          </div>
                        </div>
                        <div>
                          <div className="marginalia">Selections</div>
                          <dl className="mt-2 grid gap-x-6 gap-y-1 grid-cols-1 sm:grid-cols-3">
                            {e.selections.map(s => (
                              <div key={s.position}>
                                <dt className="smallcaps text-[0.68rem] text-ink-soft">{s.position}</dt>
                                <dd className="font-display text-lg">{s.candidate}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              {/* origin */}
              <li className="relative pl-10 pt-2">
                <span className="absolute left-1 top-3 h-5 w-5 rounded-full bg-ink" />
                <div className="border-2 border-dashed border-ink/40 p-4">
                  <div className="marginalia">Genesis · Ballot locked</div>
                  <p className="hash-mono mt-1">{ELECTION.ballot_hash}</p>
                  <p className="text-sm text-ink-soft mt-1">{ELECTION.ballot_locked_at}</p>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}
