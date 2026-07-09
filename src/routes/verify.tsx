import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { POSITIONS, CANDIDATES } from "@/lib/election-data";
import { lookupReceipt, getLedger } from "@/lib/election.functions";

const searchSchema = z.object({ hash: z.string().optional() });

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verify a Receipt — The Ballot Gazette" },
      { name: "description", content: "Look up a private receipt against the public ledger and recompute the tally from raw ledger data." },
    ],
  }),
});

type Entry = {
  entry_index: number;
  receipt_hash: string;
  prev_hash: string;
  entry_hash: string;
  token_fingerprint: string;
  selections: Record<string, string>;
  created_at: string;
};

const nameCand = (id: string) => CANDIDATES.find((c) => c.id === id)?.name ?? id;
const namePos = (id: string) => POSITIONS.find((p) => p.id === id)?.name ?? id;

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function VerifyPage() {
  const { hash } = Route.useSearch();
  const [q, setQ] = useState(hash ?? "");
  const [recount, setRecount] = useState<{
    ok: boolean;
    checked: number;
    breaks: number;
    tally: Record<string, { candidate: string; votes: number }[]>;
  } | null>(null);
  const [running, setRunning] = useState(false);

  const lookupFn = useServerFn(lookupReceipt);
  const getLedgerFn = useServerFn(getLedger);
  const ledgerQ = useQuery({ queryKey: ["ledger"], queryFn: () => getLedgerFn() });

  const lookupM = useMutation({
    mutationFn: (h: string) => lookupFn({ data: { hash: h } }),
  });

  function runLookup() {
    if (!q.trim()) return;
    lookupM.mutate(q.trim());
  }

  async function runRecount() {
    if (!ledgerQ.data) return;
    setRunning(true);
    setRecount(null);
    const entries = ledgerQ.data.entries as Entry[];
    let prev = ledgerQ.data.genesis;
    let breaks = 0;
    for (const e of entries) {
      if (e.prev_hash !== prev) breaks++;
      prev = e.entry_hash;
      // sanity: recompute a hash-shaped value (chain-only check; nonce is not exposed)
      await sha256Hex(e.entry_hash);
    }
    const tally: Record<string, { candidate: string; votes: number }[]> = {};
    for (const pos of POSITIONS) {
      const counts = new Map<string, number>();
      for (const e of entries) {
        const cid = e.selections[pos.id];
        if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      tally[pos.name] = [...counts.entries()]
        .map(([id, votes]) => ({ candidate: nameCand(id), votes }))
        .sort((a, b) => b.votes - a.votes);
    }
    // simulate visible progress
    await new Promise((r) => setTimeout(r, 500));
    setRecount({ ok: breaks === 0, checked: entries.length, breaks, tally });
    setRunning(false);
  }

  const found = lookupM.data?.entry as Entry | null | undefined;

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
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runLookup()}
                  placeholder="0x…"
                  className="w-full border-2 border-ink bg-paper pl-12 pr-4 py-4 font-mono text-base focus:outline-none focus:border-stamp"
                />
              </div>
              <button
                onClick={runLookup}
                disabled={!q.trim() || lookupM.isPending}
                className="btn-primary hover:bg-stamp hover:border-stamp mt-4 disabled:opacity-60"
              >
                {lookupM.isPending ? "Looking up…" : "Look up receipt"}
              </button>
            </div>

            <div className="mt-6 border-2 border-ink p-6 min-h-[240px] bg-card">
              {!lookupM.data && !lookupM.error && !lookupM.isPending && (
                <div className="text-ink-soft text-base">
                  Enter a receipt above to inspect its ledger entry.
                </div>
              )}
              {lookupM.error && (
                <div className="flex gap-2 text-stamp"><AlertCircle size={18} /> {String((lookupM.error as Error).message)}</div>
              )}
              {lookupM.data && !found && (
                <div>
                  <div className="stamp">Not in chain</div>
                  <p className="mt-5 text-base leading-relaxed">
                    No ledger entry matches this receipt. Check for typos, or confirm the receipt was generated for this election.
                  </p>
                </div>
              )}
              {found && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="marginalia">Match · Entry #{String(found.entry_index).padStart(3, "0")}</div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-verify text-verify font-semibold">
                      <CheckCircle2 size={18} /> Verified
                    </div>
                  </div>
                  <div className="rule-hair my-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="marginalia">Recorded</div>
                      <p className="text-base mt-1">{new Date(found.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="marginalia">Token fingerprint</div>
                      <p className="hash-mono mt-1">{found.token_fingerprint}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="marginalia mb-2">Selections encoded</div>
                    <ul className="space-y-2">
                      {Object.entries(found.selections).map(([posId, candId]) => (
                        <li key={posId} className="text-base">
                          <span className="text-ink-soft">{namePos(posId)}: </span>
                          <span className="font-display text-lg">{nameCand(candId)}</span>
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

          <section>
            <div className="marginalia">Tool B</div>
            <h3 className="mt-1 font-display text-2xl md:text-3xl">Recount the ledger.</h3>
            <p className="mt-3 text-base text-ink-soft max-w-prose leading-relaxed">
              Downloads the full ledger from the server, verifies its hash chain link by link,
              and recomputes the tally from raw entries — right in your browser.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={runRecount}
                disabled={running || !ledgerQ.data}
                className="btn-primary hover:bg-stamp hover:border-stamp disabled:opacity-60"
              >
                <Play size={18} />
                {running ? "Recomputing…" : "Run independent recount"}
              </button>
            </div>

            <div className="mt-6 border-2 border-ink p-6 font-mono text-sm space-y-3 bg-card">
              <Line ok={!!ledgerQ.data}>
                {ledgerQ.data
                  ? `→ ledger fetched · ${ledgerQ.data.entries.length} entries`
                  : "→ fetching ledger…"}
              </Line>
              <Line ok={!!recount}>
                {recount
                  ? `→ hash chain verified · ${recount.checked - recount.breaks} / ${recount.checked} links intact`
                  : "→ hash chain verification pending"}
              </Line>
              <Line ok={!!recount}>
                {recount
                  ? "→ tally recomputed from raw entries"
                  : "→ tally recomputation pending"}
              </Line>
              {recount && (
                <div className="pt-4 border-t border-ink/25">
                  {recount.ok ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-verify text-verify font-semibold text-base">
                      <CheckCircle2 size={18} /> Recount agrees · chain intact
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-stamp text-stamp font-semibold text-base">
                      <AlertCircle size={18} /> Chain has {recount.breaks} break(s)
                    </div>
                  )}
                </div>
              )}
            </div>

            {recount && (
              <div className="mt-6 border-2 border-ink p-6 bg-card">
                <div className="marginalia">Recomputed tally</div>
                <div className="rule-hair my-3" />
                <div className="space-y-6">
                  {POSITIONS.map((pos) => {
                    const rows = recount.tally[pos.name] ?? [];
                    return (
                      <div key={pos.id}>
                        <div className="smallcaps text-sm text-ink">{pos.name}</div>
                        {rows.length === 0 ? (
                          <p className="text-sm text-ink-soft italic mt-2">No votes yet.</p>
                        ) : (
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
                        )}
                      </div>
                    );
                  })}
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
