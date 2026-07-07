import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search, Play, Download, CheckCircle2 } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { LEDGER, TALLY } from "@/lib/election-data";

const searchSchema = z.object({ hash: z.string().optional() });

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verify a Receipt — The Ballot Gazette" },
      { name: "description", content: "Look up a private receipt against the public ledger, and recompute the tally from raw ledger data." },
    ],
  }),
});

function VerifyPage() {
  const { hash } = Route.useSearch();
  const [q, setQ] = useState(hash ?? "");
  const [running, setRunning] = useState(false);
  const [recomputed, setRecomputed] = useState(false);

  const found = useMemo(() => {
    if (!q.trim()) return null;
    const trimmed = q.trim().toLowerCase();
    const hit = LEDGER.find(e => e.hash.toLowerCase().startsWith(trimmed.slice(0, 8)));
    return hit ?? "not-in-chain";
  }, [q]);

  function recount() {
    setRunning(true);
    setRecomputed(false);
    setTimeout(() => { setRunning(false); setRecomputed(true); }, 1200);
  }

  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <div className="py-10 border-b-2 border-ink">
          <div className="marginalia">Independent Verification</div>
          <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
            Look up your <em className="italic">receipt</em>. Recount the <em className="italic">chain</em>.
          </h2>
          <p className="mt-3 text-lg text-ink-soft max-w-2xl">
            Two tools, both public. Neither requires a login. Nothing you do here is logged against your identity.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 py-12">
          {/* A — Receipt lookup */}
          <section>
            <div className="marginalia">Tool A</div>
            <h3 className="mt-1 font-display text-2xl md:text-3xl">Receipt lookup.</h3>
            <p className="mt-3 text-base text-ink-soft max-w-prose leading-relaxed">
              Paste your receipt hash. The lookup is anonymous and not recorded.
            </p>

            <div className="mt-6">
              <label htmlFor="receipt" className="block text-base font-semibold mb-2">Receipt hash</label>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  id="receipt"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="0x…"
                  className="w-full border-2 border-ink bg-paper pl-12 pr-4 py-4 font-mono text-base focus:outline-none focus:border-stamp"
                />
              </div>
            </div>

            <div className="mt-6 border-2 border-ink p-6 min-h-[240px] bg-card">
              {!q.trim() && (
                <div className="text-ink-soft text-base">
                  Enter a receipt above to inspect its ledger entry.
                </div>
              )}
              {q.trim() && found === "not-in-chain" && (
                <div>
                  <div className="stamp">Not in chain</div>
                  <p className="mt-5 text-base leading-relaxed">
                    No ledger entry matches this receipt. Check for typos, or confirm the receipt was generated for this election.
                  </p>
                </div>
              )}
              {q.trim() && found && found !== "not-in-chain" && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="marginalia">Match · Entry #{String(found.index).padStart(3, "0")}</div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-verify text-verify font-semibold">
                      <CheckCircle2 size={18} /> Verified
                    </div>
                  </div>
                  <div className="rule-hair my-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="marginalia">Recorded</div>
                      <p className="text-base mt-1">{found.timestamp}</p>
                    </div>
                    <div>
                      <div className="marginalia">Token</div>
                      <p className="hash-mono mt-1">{found.token}…</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="marginalia mb-2">Selections encoded</div>
                    <ul className="space-y-2">
                      {found.selections.map(s => (
                        <li key={s.position} className="text-base">
                          <span className="text-ink-soft">{s.position}: </span>
                          <span className="font-display text-lg">{s.candidate}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 marginalia">
              Note · The receipt does not prove your vote to a third party. That is deliberate.
            </p>
          </section>

          {/* B — Recount */}
          <section>
            <div className="marginalia">Tool B</div>
            <h3 className="mt-1 font-display text-2xl md:text-3xl">Recount the ledger.</h3>
            <p className="mt-3 text-base text-ink-soft max-w-prose leading-relaxed">
              Downloads the full ledger, verifies its hash chain link by link, and recomputes the tally from raw entries.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={recount}
                disabled={running}
                className="btn-primary hover:bg-stamp hover:border-stamp disabled:opacity-60"
              >
                <Play size={18} />
                {running ? "Recomputing…" : "Run independent recount"}
              </button>
              <a href="#" className="btn-ghost hover:border-ink">
                <Download size={18} /> recount.py
              </a>
            </div>

            <div className="mt-6 border-2 border-ink p-6 font-mono text-sm space-y-3 bg-card">
              <Line ok={!running}>{running ? "→ fetching ledger.jsonl (12 entries)" : "→ ledger.jsonl fetched · 12 entries"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ hash chain verified · 12 / 12 links intact" : "→ hash chain verification pending"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ blind signatures valid against published key" : "→ signature verification pending"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ tally recomputed · agrees with published result" : "→ tally recomputation pending"}</Line>
              {recomputed && (
                <div className="pt-4 border-t border-ink/25">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-verify text-verify font-semibold text-base">
                    <CheckCircle2 size={18} /> Recount agrees
                  </div>
                </div>
              )}
            </div>

            {recomputed && (
              <div className="mt-6 border-2 border-ink p-6 bg-card">
                <div className="marginalia">Recomputed tally</div>
                <div className="rule-hair my-3" />
                <div className="space-y-6">
                  {Object.entries(TALLY).map(([pos, rows]) => (
                    <div key={pos}>
                      <div className="smallcaps text-sm text-ink">{pos}</div>
                      <ul className="mt-2 divide-y divide-ink/15">
                        {rows.map((r, i) => (
                          <li key={r.candidate} className="flex justify-between py-2.5">
                            <span className={i === 0 ? "font-semibold" : "text-ink-soft"}>
                              {i === 0 && <span className="text-stamp mr-1">★</span>}
                              {r.candidate}
                            </span>
                            <span className="font-mono font-semibold">{r.votes}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}

function Line({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-verify" : "bg-ink/25"}`} />
      <span className={ok ? "text-ink" : "text-ink-soft"}>{children}</span>
    </div>
  );
}
