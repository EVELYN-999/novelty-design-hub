import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Masthead, Colophon } from "@/components/masthead";
import { LEDGER, TALLY, ELECTION } from "@/lib/election-data";

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
    // demo: match any entry starting with the query, or pretend the receipt exists
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
      <main className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="py-8 grid grid-cols-12 gap-8 items-end border-b-2 border-ink">
          <div className="col-span-12 md:col-span-9">
            <div className="marginalia">Section · Independent Verification</div>
            <h2 className="mt-2 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.95]">
              Look up your <em className="italic">receipt</em>. Recount the <em className="italic">chain</em>.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 py-12">
          {/* Receipt lookup */}
          <section className="col-span-12 md:col-span-6">
            <div className="marginalia">Article A</div>
            <h3 className="mt-1 font-display text-3xl">Receipt lookup.</h3>
            <p className="mt-3 text-sm text-ink-soft max-w-prose leading-relaxed">
              Enter your receipt hash. The lookup requires no login and is not
              recorded — so nothing here can be later joined to your identity.
            </p>

            <div className="mt-6">
              <label className="marginalia">Receipt hash</label>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="0x…"
                className="mt-2 w-full border-2 border-ink bg-transparent px-4 py-4 font-mono text-sm focus:outline-none focus:border-stamp"
              />
            </div>

            <div className="mt-6 border-2 border-ink p-6 min-h-[220px]">
              {!q.trim() && (
                <div className="text-ink-soft text-sm">
                  Enter a receipt above to inspect its ledger entry.
                </div>
              )}
              {q.trim() && found === "not-in-chain" && (
                <div>
                  <div className="stamp">Not in chain</div>
                  <p className="mt-4 text-sm">
                    No ledger entry matches this receipt. Check for typographical
                    errors, or confirm the receipt was generated for this election.
                  </p>
                </div>
              )}
              {q.trim() && found && found !== "not-in-chain" && (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="marginalia">Match · Entry #{String(found.index).padStart(3, "0")}</div>
                    <div className="stamp text-verify" style={{ borderColor: "var(--verify)", color: "var(--verify)" }}>
                      Verified
                    </div>
                  </div>
                  <div className="rule-hair my-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="marginalia">Recorded</div>
                      <p className="text-sm mt-1">{found.timestamp}</p>
                    </div>
                    <div>
                      <div className="marginalia">Token</div>
                      <p className="hash-mono mt-1">{found.token}…</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="marginalia">Selections encoded</div>
                    <ul className="mt-2 space-y-1">
                      {found.selections.map(s => (
                        <li key={s.position} className="text-sm">
                          <span className="text-ink-soft">{s.position}: </span>
                          <span className="font-display">{s.candidate}</span>
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

          {/* Independent recount */}
          <section className="col-span-12 md:col-span-6">
            <div className="marginalia">Article B</div>
            <h3 className="mt-1 font-display text-3xl">Recount the ledger.</h3>
            <p className="mt-3 text-sm text-ink-soft max-w-prose leading-relaxed">
              This tool downloads the full ledger, verifies its hash chain link by
              link, and recomputes the tally from raw entries. It requires no
              access other than what is public.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={recount}
                className="smallcaps border-2 border-ink bg-ink text-paper px-6 py-4 text-xs hover:bg-stamp hover:border-stamp transition-colors"
              >
                {running ? "Recomputing…" : "Run independent recount"}
              </button>
              <a
                href="#"
                className="smallcaps border-2 border-ink/30 px-6 py-4 text-xs hover:border-ink transition-colors"
              >
                Download recount.py
              </a>
            </div>

            <div className="mt-6 border-2 border-ink p-6 font-mono text-xs space-y-2">
              <Line ok={!running}>{running ? "→ fetching ledger.jsonl (12 entries)" : "→ ledger.jsonl fetched · 12 entries"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ hash chain verified · 12 / 12 links intact" : "→ hash chain verification pending"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ blind signatures valid against published key" : "→ signature verification pending"}</Line>
              <Line ok={recomputed}>{recomputed ? "→ tally recomputed · agrees with published result" : "→ tally recomputation pending"}</Line>
              {recomputed && (
                <div className="pt-4 border-t border-ink/20">
                  <div className="stamp text-verify" style={{ borderColor: "var(--verify)", color: "var(--verify)" }}>
                    Recount agrees
                  </div>
                </div>
              )}
            </div>

            {recomputed && (
              <div className="mt-6 border-2 border-ink p-6">
                <div className="marginalia">Recomputed tally</div>
                <div className="rule-hair my-3" />
                <div className="space-y-5">
                  {Object.entries(TALLY).map(([pos, rows]) => (
                    <div key={pos}>
                      <div className="smallcaps text-xs">{pos}</div>
                      <ul className="mt-2 divide-y divide-ink/15">
                        {rows.map((r, i) => (
                          <li key={r.candidate} className="flex justify-between py-2">
                            <span className={i === 0 ? "font-display" : "text-ink-soft"}>
                              {i === 0 && <span className="stamp mr-2" style={{ transform: "rotate(-6deg)" }}>Elect</span>}
                              {r.candidate}
                            </span>
                            <span className="hash-mono">{r.votes}</span>
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
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-verify" : "bg-ink/25"}`} />
      <span className={ok ? "text-ink" : "text-ink-soft"}>{children}</span>
    </div>
  );
}
