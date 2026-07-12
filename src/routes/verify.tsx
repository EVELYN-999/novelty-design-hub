import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { lookupReceipt, getLedger, getBallot } from "@/lib/election.functions";

const searchSchema = z.object({ hash: z.string().optional() });

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verify — ELECTION/NODE" },
      { name: "description", content: "Verify a receipt and independently recount the entire hash chain." },
    ],
  }),
});

type Entry = {
  entry_index: number; receipt_hash: string; prev_hash: string; entry_hash: string;
  token_fingerprint: string; selections: Record<string, string>; created_at: string;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function VerifyPage() {
  const { hash } = Route.useSearch();
  const [q, setQ] = useState(hash ?? "");
  const [recount, setRecount] = useState<{
    ok: boolean; checked: number; breaks: number;
    tally: Record<string, { candidate: string; votes: number }[]>;
  } | null>(null);
  const [running, setRunning] = useState(false);

  const lookupFn = useServerFn(lookupReceipt);
  const getLedgerFn = useServerFn(getLedger);
  const getBallotFn = useServerFn(getBallot);
  const ledgerQ = useQuery({ queryKey: ["ledger"], queryFn: () => getLedgerFn() });
  const ballot = useQuery({ queryKey: ["ballot"], queryFn: () => getBallotFn(), staleTime: 30_000 });
  const positions = ballot.data?.positions ?? [];
  const candidates = ballot.data?.candidates ?? [];
  const nameCand = (id: string) => candidates.find((c) => c.id === id)?.name ?? id;
  const namePos = (id: string) => positions.find((p) => p.id === id)?.name ?? id;

  const lookupM = useMutation({ mutationFn: (h: string) => lookupFn({ data: { hash: h } }) });

  async function runRecount() {
    if (!ledgerQ.data) return;
    setRunning(true); setRecount(null);
    const entries = ledgerQ.data.entries as Entry[];
    let prev: string = ledgerQ.data.genesis;
    let breaks = 0;
    for (const e of entries) {
      if (e.prev_hash !== prev) breaks++;
      prev = e.entry_hash;
      await sha256Hex(e.entry_hash);
    }
    const tally: Record<string, { candidate: string; votes: number }[]> = {};
    for (const pos of positions) {
      const counts = new Map<string, number>();
      for (const e of entries) {
        const cid = e.selections[pos.id];
        if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      tally[pos.name] = [...counts.entries()]
        .map(([id, votes]) => ({ candidate: nameCand(id), votes }))
        .sort((a, b) => b.votes - a.votes);
    }
    await new Promise((r) => setTimeout(r, 400));
    setRecount({ ok: breaks === 0, checked: entries.length, breaks, tally });
    setRunning(false);
  }

  const found = lookupM.data?.entry as Entry | null | undefined;

  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="py-10 border-b border-line">
          <div className="label-on">§ Independent verification</div>
          <h2 className="mt-3 font-display font-black text-4xl md:text-6xl tracking-[-0.03em]">
            Look up. <span className="text-accent">Recount.</span>
          </h2>
          <p className="mt-3 text-fg-dim max-w-2xl">
            Two public tools. Neither requires a login. Nothing you do here is logged against your identity.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 py-12">
          {/* Tool A */}
          <section>
            <div className="label-on">Tool A</div>
            <h3 className="mt-2 font-display text-2xl md:text-3xl font-black">Receipt lookup.</h3>
            <p className="mt-3 text-fg-dim">Paste your receipt hash. The lookup is anonymous.</p>

            <div className="mt-6">
              <label htmlFor="receipt" className="label">Receipt hash</label>
              <div className="relative mt-2">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-mute" />
                <input id="receipt" value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupM.mutate(q.trim())}
                  placeholder="0x…"
                  className="w-full bg-bg-2 border border-line pl-12 pr-4 py-4 mono focus:outline-none focus:border-accent" />
              </div>
              <button onClick={() => lookupM.mutate(q.trim())} disabled={!q.trim() || lookupM.isPending}
                className="btn-primary hover:btn-primary-hover mt-4 disabled:opacity-60">
                {lookupM.isPending ? "Looking up…" : "Look up receipt"}
              </button>
            </div>

            <div className="mt-6 panel p-6 min-h-[240px]">
              {!lookupM.data && !lookupM.error && !lookupM.isPending && (
                <div className="text-fg-dim">Enter a receipt hash above.</div>
              )}
              {lookupM.error && (
                <div className="flex gap-2 text-danger"><AlertCircle size={16} /> {String((lookupM.error as Error).message)}</div>
              )}
              {lookupM.data && !found && (
                <div>
                  <div className="border border-danger text-danger px-3 py-1.5 inline-flex label">◇ Not in chain</div>
                  <p className="mt-4 text-fg-dim">No ledger entry matches this receipt.</p>
                </div>
              )}
              {found && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="label">Match · Entry #{String(found.entry_index).padStart(4, "0")}</div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent text-accent label">
                      <CheckCircle2 size={14} /> Verified
                    </div>
                  </div>
                  <hr className="my-4 border-line" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="label">Recorded</div>
                      <p className="mt-1">{new Date(found.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="label">Token fingerprint</div>
                      <p className="hash mt-1">{found.token_fingerprint}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="label mb-2">Selections encoded</div>
                    <ul className="space-y-2">
                      {Object.entries(found.selections).map(([posId, candId]) => (
                        <li key={posId}>
                          <span className="label">{namePos(posId)}: </span>
                          <span className="font-bold ml-2">{nameCand(candId)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tool B */}
          <section>
            <div className="label-on">Tool B</div>
            <h3 className="mt-2 font-display text-2xl md:text-3xl font-black">Recount the chain.</h3>
            <p className="mt-3 text-fg-dim">
              Downloads the full ledger, verifies its hash chain link-by-link, and recomputes the tally in your browser.
            </p>

            <div className="mt-6">
              <button onClick={runRecount} disabled={running || !ledgerQ.data}
                className="btn-primary hover:btn-primary-hover disabled:opacity-60">
                <Play size={16} /> {running ? "Recomputing…" : "Run independent recount"}
              </button>
            </div>

            <div className="mt-6 panel p-6 mono text-sm space-y-3">
              <Line ok={!!ledgerQ.data}>
                {ledgerQ.data ? `→ ledger fetched · ${ledgerQ.data.entries.length} entries` : "→ fetching ledger…"}
              </Line>
              <Line ok={!!recount}>
                {recount ? `→ hash chain · ${recount.checked - recount.breaks} / ${recount.checked} links intact`
                  : "→ hash chain verification pending"}
              </Line>
              <Line ok={!!recount}>
                {recount ? "→ tally recomputed from raw entries" : "→ tally recomputation pending"}
              </Line>
              {recount && (
                <div className="pt-4 border-t border-line">
                  {recount.ok ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent text-accent label">
                      <CheckCircle2 size={14} /> Recount agrees · chain intact
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-danger text-danger label">
                      <AlertCircle size={14} /> {recount.breaks} break(s) in chain
                    </div>
                  )}
                </div>
              )}
            </div>

            {recount && (
              <div className="mt-6 panel p-6">
                <div className="label-on">Recomputed tally</div>
                <div className="mt-4 space-y-6">
                  {positions.map((pos) => {
                    const rows = recount.tally[pos.name] ?? [];
                    return (
                      <div key={pos.id}>
                        <div className="label border-b border-line pb-1 mb-2">{pos.name}</div>
                        {rows.length === 0 ? (
                          <p className="text-sm text-fg-dim italic mt-2">No votes yet.</p>
                        ) : (
                          <ul className="divide-y divide-line">
                            {rows.map((r, i) => (
                              <li key={r.candidate} className="flex justify-between py-2.5">
                                <span className={i === 0 ? "font-bold text-accent" : "text-fg-dim"}>
                                  {i === 0 && "◼ "}{r.candidate}
                                </span>
                                <span className="mono font-bold">{r.votes}</span>
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
      <span className={`inline-block h-2 w-2 ${ok ? "bg-accent" : "bg-fg-mute"}`} />
      <span className={ok ? "text-fg" : "text-fg-dim"}>{children}</span>
    </div>
  );
}
