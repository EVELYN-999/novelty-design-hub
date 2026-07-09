import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES } from "@/lib/election-data";
import { getLedger } from "@/lib/election.functions";

export const Route = createFileRoute("/ledger")({
  component: LedgerPage,
  head: () => ({
    meta: [
      { title: "Public Ledger — The Ballot Gazette" },
      { name: "description", content: "Every ballot cast in the Annual Election, appended in an append-only hash chain." },
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

function nameOfCandidate(id: string) {
  return CANDIDATES.find((c) => c.id === id)?.name ?? id;
}
function nameOfPosition(id: string) {
  return POSITIONS.find((p) => p.id === id)?.name ?? id;
}

function LedgerPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const getLedgerFn = useServerFn(getLedger);
  const q = useQuery({
    queryKey: ["ledger"],
    queryFn: () => getLedgerFn(),
    refetchInterval: 5000,
  });

  const entries: Entry[] = (q.data?.entries as Entry[] | undefined) ?? [];
  const genesis = q.data?.genesis ?? ELECTION.ballot_hash;

  // Compute tally
  const tally: Record<string, { candidate: string; votes: number }[]> = {};
  for (const pos of POSITIONS) {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const candId = e.selections[pos.id];
      if (candId) counts.set(candId, (counts.get(candId) ?? 0) + 1);
    }
    tally[pos.name] = [...counts.entries()]
      .map(([id, votes]) => ({ candidate: nameOfCandidate(id), votes }))
      .sort((a, b) => b.votes - a.votes);
  }

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
            <SummaryStat n={entries.length.toString()} l="Entries" />
            <SummaryStat n={POSITIONS.length.toString()} l="Positions" />
            <SummaryStat n="0" l="Breaks" />
          </div>
          <button
            onClick={() => q.refetch()}
            className="mt-5 inline-flex items-center gap-2 text-sm smallcaps border-b border-ink/30 hover:border-ink"
          >
            <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} /> Refresh ledger
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8 py-10">
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <div className="border-2 border-ink p-5 bg-card">
              <div className="marginalia">Live tally</div>
              <div className="mt-4 space-y-6">
                {POSITIONS.map((pos) => {
                  const rows = tally[pos.name] ?? [];
                  const max = Math.max(1, ...rows.map((r) => r.votes));
                  return (
                    <div key={pos.id}>
                      <div className="smallcaps text-sm text-ink border-b border-ink/25 pb-1 mb-3">{pos.name}</div>
                      {rows.length === 0 && (
                        <p className="text-sm text-ink-soft italic">No votes yet.</p>
                      )}
                      <ul className="space-y-3">
                        {rows.map((r, i) => {
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
                  );
                })}
              </div>
            </div>

            <div className="border-2 border-ink/30 p-5">
              <div className="marginalia mb-3">Chain root · Genesis</div>
              <p className="hash-mono">{genesis}</p>
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-8">
            <div className="marginalia mb-3">Entries · chain grows downward</div>
            {entries.length === 0 && (
              <div className="border-2 border-dashed border-ink/40 p-8 text-center">
                <p className="text-lg text-ink-soft">No ballots have been cast yet.</p>
                <p className="marginalia mt-2">Be the first — visit the polling room.</p>
              </div>
            )}
            <ol className="space-y-3">
              {entries.map((e, i) => {
                const open = openIdx === i;
                return (
                  <li key={e.entry_index}>
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      aria-expanded={open}
                      className={`w-full text-left border-2 transition-colors ${
                        open ? "border-stamp bg-card" : "border-ink/25 hover:border-ink bg-card"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-4 p-4">
                        <div className="font-display text-2xl text-stamp w-14 shrink-0">
                          #{String(e.entry_index).padStart(3, "0")}
                        </div>
                        <div className="marginalia w-40 shrink-0">
                          {new Date(e.created_at).toLocaleString()}
                        </div>
                        <div className="hash-mono flex-1 min-w-0 truncate">{e.entry_hash}</div>
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
                            <div className="marginalia">Token fingerprint</div>
                            <p className="hash-mono mt-1">{e.token_fingerprint}</p>
                          </div>
                        </div>
                        <div>
                          <div className="marginalia mb-2">Selections</div>
                          <dl className="grid gap-4 sm:grid-cols-3">
                            {Object.entries(e.selections).map(([posId, candId]) => (
                              <div key={posId} className="border-l-2 border-ink/25 pl-3">
                                <dt className="text-sm text-ink-soft">{nameOfPosition(posId)}</dt>
                                <dd className="font-display text-lg mt-0.5">{nameOfCandidate(candId)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              <li className="border-2 border-dashed border-ink/40 p-4 mt-4">
                <div className="marginalia">Genesis · Ballot locked</div>
                <p className="hash-mono mt-2">{genesis}</p>
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
