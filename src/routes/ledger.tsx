import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, RefreshCw, Radio } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { getBallot, getLedger } from "@/lib/election.functions";

export const Route = createFileRoute("/ledger")({
  component: LedgerPage,
  head: () => ({
    meta: [
      { title: "Public Ledger — ELECTION/NODE" },
      { name: "description", content: "Every ballot cast, appended to a public hash chain." },
    ],
  }),
});

type Entry = {
  entry_index: number; receipt_hash: string; prev_hash: string; entry_hash: string;
  token_fingerprint: string; selections: Record<string, string>; created_at: string;
};

function LedgerPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const getLedgerFn = useServerFn(getLedger);
  const getBallotFn = useServerFn(getBallot);

  const q = useQuery({ queryKey: ["ledger"], queryFn: () => getLedgerFn(), refetchInterval: 5000 });
  const ballot = useQuery({ queryKey: ["ballot"], queryFn: () => getBallotFn(), staleTime: 30_000 });

  const positions = ballot.data?.positions ?? [];
  const candidates = ballot.data?.candidates ?? [];
  const nameCand = (id: string) => candidates.find((c) => c.id === id)?.name ?? id.slice(0, 10);
  const namePos = (id: string) => positions.find((p) => p.id === id)?.name ?? id.slice(0, 10);

  const entries: Entry[] = ((q.data?.entries ?? []) as Entry[]);
  const genesis = q.data?.genesis ?? "";
  const ballotHash = ballot.data?.election?.ballot_hash ?? genesis;

  const tally = useMemo(() => {
    const out: Record<string, { candidate: string; votes: number }[]> = {};
    for (const pos of positions) {
      const counts = new Map<string, number>();
      for (const e of entries) {
        const cid = e.selections[pos.id];
        if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      out[pos.name] = [...counts.entries()]
        .map(([id, votes]) => ({ candidate: nameCand(id), votes }))
        .sort((a, b) => b.votes - a.votes);
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, candidates, entries]);

  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="py-10 border-b border-line">
          <div className="label-on">§ Public ledger</div>
          <h2 className="mt-3 font-display font-black text-4xl md:text-6xl tracking-[-0.03em]">
            Every ballot. <span className="text-accent">Hash-linked.</span>
          </h2>
          <p className="mt-3 text-fg-dim max-w-2xl">
            Ordered by arrival. Each entry embeds the hash of the previous. Any silent rewrite of the past breaks the chain.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="border border-line px-4 py-2 label flex items-center gap-2">
              <Radio size={12} className="text-accent animate-pulse" /> Streaming · 5s refresh
            </div>
            <button onClick={() => q.refetch()} className="btn hover:border-accent hover:text-accent">
              <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 py-10">
          <aside className="col-span-12 lg:col-span-4 space-y-4">
            <div className="panel p-5">
              <div className="label-on">Live tally</div>
              <div className="mt-5 space-y-6">
                {positions.map((pos) => {
                  const rows = tally[pos.name] ?? [];
                  const max = Math.max(1, ...rows.map((r) => r.votes));
                  return (
                    <div key={pos.id}>
                      <div className="label border-b border-line pb-1 mb-3">{pos.name}</div>
                      {rows.length === 0 && <p className="text-sm text-fg-dim italic">No votes yet.</p>}
                      <ul className="space-y-2">
                        {rows.map((r, i) => {
                          const pct = (r.votes / max) * 100;
                          const leader = i === 0;
                          return (
                            <li key={r.candidate}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className={leader ? "font-bold" : "text-fg-dim"}>{r.candidate}</span>
                                <span className="mono font-bold">{r.votes}</span>
                              </div>
                              <div className="h-1.5 bg-bg-2 border border-line-dim">
                                <div className={leader ? "h-full bg-accent" : "h-full bg-fg-mute"} style={{ width: `${pct}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-5">
              <div className="label">Genesis / ballot hash</div>
              <p className="hash mt-2">{ballotHash}</p>
            </div>

            <div className="panel p-5">
              <div className="grid grid-cols-3 gap-4">
                <Stat n={entries.length.toString()} l="Entries" />
                <Stat n={positions.length.toString()} l="Positions" />
                <Stat n="0" l="Breaks" />
              </div>
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-8">
            <div className="label mb-4">Entries · chain grows downward</div>
            {entries.length === 0 && (
              <div className="border border-dashed border-line p-8 text-center text-fg-dim">
                <p>No ballots have been cast yet.</p>
                <p className="label mt-2">Be the first — visit the polling node.</p>
              </div>
            )}
            <ol className="space-y-2">
              {entries.map((e, i) => {
                const open = openIdx === i;
                return (
                  <li key={e.entry_index}>
                    <button onClick={() => setOpenIdx(open ? null : i)} aria-expanded={open}
                      className={`w-full text-left border transition-colors ${
                        open ? "border-accent bg-panel" : "border-line hover:border-fg-dim bg-panel"
                      }`}>
                      <div className="flex flex-wrap items-center gap-4 p-4">
                        <div className="mono text-xl text-accent font-bold w-16 shrink-0">
                          #{String(e.entry_index).padStart(4, "0")}
                        </div>
                        <div className="label w-40 shrink-0">{new Date(e.created_at).toLocaleTimeString()}</div>
                        <div className="hash flex-1 min-w-0 truncate">{e.entry_hash}</div>
                        <div className="ml-auto text-fg-dim">
                          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="mt-1 border-l-2 border-accent bg-bg-2 pl-5 pr-4 py-5 space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="label">Prev hash</div>
                            <p className="hash mt-1">{e.prev_hash}</p>
                          </div>
                          <div>
                            <div className="label">Token fingerprint</div>
                            <p className="hash mt-1">{e.token_fingerprint}</p>
                          </div>
                        </div>
                        <div>
                          <div className="label mb-2">Selections</div>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            {Object.entries(e.selections).map(([posId, candId]) => (
                              <div key={posId} className="border-l-2 border-line pl-3">
                                <dt className="label">{namePos(posId)}</dt>
                                <dd className="font-bold mt-0.5">{nameCand(candId)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              <li className="border border-dashed border-line p-4">
                <div className="label">◼ Genesis · chain root</div>
                <p className="hash mt-2">{genesis}</p>
              </li>
            </ol>
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="mono text-2xl font-bold">{n}</div>
      <div className="label mt-1">{l}</div>
    </div>
  );
}
