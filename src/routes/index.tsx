import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Vote, ScrollText, ShieldCheck, Cpu, Lock, Radio } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, accentFor, initialsOf } from "@/lib/election-data";
import { getBallot, getStats } from "@/lib/election.functions";

export const Route = createFileRoute("/")({
  component: FrontPage,
  head: () => ({
    meta: [
      { title: "ELECTION/NODE — Verifiable Ballot MMXXVI" },
      { name: "description", content: "Blind-signature voting with a public, hash-chained ledger. Cast, receipt, and independently recount every ballot." },
    ],
  }),
});

function FrontPage() {
  const getBallotFn = useServerFn(getBallot);
  const getStatsFn = useServerFn(getStats);
  const ballot = useQuery({ queryKey: ["ballot"], queryFn: () => getBallotFn(), staleTime: 30_000 });
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getStatsFn(), refetchInterval: 8000 });

  const positions = ballot.data?.positions ?? [];
  const candidates = ballot.data?.candidates ?? [];
  const election = ballot.data?.election;
  const cast = stats.data?.castCount ?? 0;
  const eligible = stats.data?.eligible ?? ELECTION.eligible_voters_fallback;
  const turnout = eligible > 0 ? ((cast / eligible) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen">
      <Masthead />

      <main className="mx-auto max-w-[1400px]">
        {/* HERO */}
        <section className="border-b border-line px-5 lg:px-10 py-12 md:py-20">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="label-on">§ Front-page dispatch</div>
              <h2 className="mt-4 font-display font-black leading-[0.95] tracking-[-0.03em]
                             text-[clamp(2.4rem,6vw,5rem)]">
                A ballot that <span className="text-accent">no-one</span> can read over your shoulder.
                A count that <span className="text-accent">anyone</span> can reproduce.
              </h2>
              <p className="mt-8 text-fg-dim text-lg max-w-2xl leading-relaxed">
                Voting is open. Every ballot is cast through a blind-signature protocol: the server signs
                a token without seeing the selections. Every ballot then lands on a public, append-only
                hash chain. There is no trusted authority — only a public artifact.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/vote" className="btn-primary hover:btn-primary-hover">
                  <Vote size={18} /> Cast ballot <ArrowRight size={16} />
                </Link>
                <Link to="/ledger" className="btn hover:text-accent hover:border-accent">
                  <ScrollText size={16} /> Read ledger
                </Link>
                <Link to="/verify" className="btn hover:text-accent hover:border-accent">
                  <ShieldCheck size={16} /> Verify receipt
                </Link>
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="panel p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="label-on flex items-center gap-2"><Radio size={12} className="animate-pulse" /> Live</span>
                  <span className="label">Node · assembly</span>
                </div>
                <div>
                  <div className="label">Turnout</div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="mono text-5xl font-bold text-accent">{turnout}</span>
                    <span className="mono text-xl text-fg-dim">%</span>
                  </div>
                  <div className="mt-3 h-2 bg-bg-2 border border-line">
                    <div className="h-full bg-accent" style={{ width: `${Math.min(100, Number(turnout))}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="Cast" value={cast.toLocaleString()} />
                  <Metric label="Eligible" value={eligible.toLocaleString()} />
                  <Metric label="Positions" value={positions.length.toString()} />
                  <Metric label="Candidates" value={candidates.length.toString()} />
                </div>
                <div className="rule pt-4">
                  <div className="label mb-1">Status</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lock size={14} className={election?.locked ? "text-accent" : "text-fg-mute"} />
                    <span className={election?.locked ? "text-accent" : "text-fg-dim"}>
                      Ballot {election?.locked ? "LOCKED" : "editable (pre-vote window)"}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Sections index */}
        <section className="border-b border-line grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line">
          <SectionCell n="01" to="/vote" title="Cast Ballot" body="ID → OTP → Ballot → Confirm → Receipt." icon={<Vote size={18} />} />
          <SectionCell n="02" to="/ledger" title="Public Ledger" body="Every ballot in a live hash chain." icon={<ScrollText size={18} />} />
          <SectionCell n="03" to="/verify" title="Verify Receipt" body="Prove your receipt sits in the chain." icon={<ShieldCheck size={18} />} />
          <SectionCell n="04" to="/admin" title="Admin Console" body="Ballot manager · analytics · lock." icon={<Cpu size={18} />} />
        </section>

        {/* Ballot preview */}
        <section className="px-5 lg:px-10 py-16 border-b border-line">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="label-on">§ Article 02</div>
              <h3 className="mt-2 font-display text-3xl md:text-5xl font-black tracking-tight">
                The ballot, published in full.
              </h3>
            </div>
            <div className="hidden md:block label">Alphabetical · bias-free rendering</div>
          </div>

          {ballot.isLoading && <div className="label">Loading ballot…</div>}

          <div className="space-y-14">
            {positions.map((pos, i) => {
              const cands = candidates.filter((c) => c.position_id === pos.id);
              return (
                <div key={pos.id}>
                  <div className="flex items-baseline justify-between border-b border-line pb-4 mb-6">
                    <div>
                      <div className="label">Position {String(i + 1).padStart(2, "0")} / {positions.length}</div>
                      <h4 className="mt-1 font-display text-2xl md:text-3xl font-black">{pos.name}</h4>
                      <p className="text-fg-dim mt-1">{pos.description}</p>
                    </div>
                    <div className="label">{cands.length} candidates</div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cands.map((c) => (
                      <div key={c.id} className="panel p-5 flex gap-4">
                        <div
                          className="h-14 w-14 shrink-0 border border-line flex items-center justify-center mono font-bold text-lg text-bg"
                          style={{ background: accentFor(c.id) }}
                        >
                          {initialsOf(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">{c.name}</div>
                          <p className="text-sm text-fg-dim mt-1 leading-snug">{c.bio}</p>
                          <div className="hash mt-2 text-[0.65rem]">{c.id.slice(0, 18)}…</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Principles */}
        <section className="px-5 lg:px-10 py-16 border-b border-line">
          <div className="max-w-2xl">
            <div className="label-on">§ Article 03</div>
            <h3 className="mt-2 font-display text-3xl md:text-5xl font-black tracking-tight">
              Six rules. No exceptions.
            </h3>
          </div>
          <div className="mt-10 grid gap-0 md:grid-cols-2 border border-line">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="p-6 border-b border-r border-line last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0 md:even:border-r-0">
                <div className="flex items-baseline gap-4">
                  <span className="mono text-accent font-bold text-2xl w-10 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h4 className="font-bold text-lg">{p.title}</h4>
                    <p className="mt-2 text-fg-dim text-sm leading-relaxed">{p.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 lg:px-10 py-24 text-center">
          <div className="label-on">§ Final call</div>
          <h3 className="mt-4 font-display text-4xl md:text-6xl font-black tracking-[-0.03em]">
            One ballot. <span className="text-accent">Cast it well.</span>
          </h3>
          <Link to="/vote" className="btn-primary hover:btn-primary-hover mt-10 inline-flex">
            <Vote size={18} /> Enter polling node <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <Colophon />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mono text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function SectionCell({ n, to, title, body, icon }: { n: string; to: string; title: string; body: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="group p-8 hover:bg-bg-2 transition-colors flex flex-col">
      <div className="flex items-center justify-between">
        <span className="mono text-accent font-bold text-2xl">{n}</span>
        <span className="text-fg-mute group-hover:text-accent transition-colors">{icon}</span>
      </div>
      <h4 className="mt-6 font-display font-black text-xl">{title}</h4>
      <p className="mt-2 text-fg-dim text-sm">{body}</p>
      <div className="mt-6 flex items-center gap-2 label group-hover:text-accent">
        Enter <ArrowRight size={12} />
      </div>
    </Link>
  );
}

const PRINCIPLES = [
  { title: "Identity, unlinked", body: "Who voted and what was voted are stored apart. No code path exists to rejoin them." },
  { title: "Blind-signature ballot", body: "The server signs a random token without seeing the selection. The vote is sealed before it is signed." },
  { title: "Tamper-evident chain", body: "Every ballot appends to a public hash chain. Any silent rewrite of the past breaks the chain, visibly." },
  { title: "Locked mid-election", body: "Once the ballot is locked, no positions or candidates can be added, edited, or removed. Enforced in the database." },
  { title: "Publicly recountable", body: "The published ledger is sufficient for anyone to recompute the tally, without the server's cooperation." },
  { title: "Coercion resistant", body: "Receipts prove your vote to you and to nobody else. Nobody can compel proof that could not be forged." },
];
