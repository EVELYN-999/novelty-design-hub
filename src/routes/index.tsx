import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getPublicElection } from "@/lib/election.functions";
import { ArrowRight, ShieldCheck, Ticket, BarChart3, Trophy, Users, Radio } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Election/Node — Live Elections & Results" },
      { name: "description", content: "See the current election, candidates, and live vote counts." },
    ],
  }),
});

function HomePage() {
  const getFn = useServerFn(getPublicElection);
  const q = useQuery({ queryKey: ["public-election"], queryFn: () => getFn(), refetchInterval: 5000 });
  const election = q.data?.election;
  const positions = q.data?.positions ?? [];
  const candidates = q.data?.candidates ?? [];
  const results = q.data?.results ?? [];

  const totalVotes = results.reduce((a, r) => a + r.votes, 0);
  const totalCandidates = candidates.length;
  const isActive = election?.status === "active";
  const isEnded = election?.status === "ended";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10 py-10">
        {/* Hero */}
        <section className="border border-line bg-panel p-8 md:p-12 relative overflow-hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 border label-on ${
                isActive ? "border-accent text-accent" : isEnded ? "border-danger text-danger" : "border-line text-fg-dim"
              }`}
            >
              {isActive && <Radio size={12} className="animate-pulse" />}
              {isActive ? "Live · Election Active" : isEnded ? "Election Ended" : election ? "Election Draft" : "No election yet"}
            </span>
          </div>
          <h1 className="mt-4 font-display font-black text-[clamp(2rem,6vw,4rem)] leading-[1.05] tracking-tight">
            {election?.title ?? "No election is currently running"}
          </h1>
          {election?.description && (
            <p className="mt-4 max-w-2xl text-fg-dim text-base md:text-lg">{election.description}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="btn-primary">
              Sign in to vote <ArrowRight size={16} />
            </Link>
            <Link to="/dashboard" className="btn">My dashboard</Link>
          </div>

          {election && (
            <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="border border-line-dim p-4 bg-bg-2">
                <div className="label flex items-center gap-2"><Users size={12}/> Votes cast</div>
                <div className="datum text-3xl mt-1 text-accent">{totalVotes}</div>
              </div>
              <div className="border border-line-dim p-4 bg-bg-2">
                <div className="label">Positions</div>
                <div className="datum text-3xl mt-1">{positions.length}</div>
              </div>
              <div className="border border-line-dim p-4 bg-bg-2 col-span-2 md:col-span-1">
                <div className="label">Candidates</div>
                <div className="datum text-3xl mt-1">{totalCandidates}</div>
              </div>
            </div>
          )}
        </section>


        {/* Feature cards */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Ticket, title: "Admin-issued tickets", body: "Each voter receives a unique one-time code, valid only for the current election." },
            { icon: ShieldCheck, title: "One vote per ticket", body: "Every ticket casts exactly one ballot. Codes terminate the moment the election ends." },
            { icon: BarChart3, title: "Live results", body: "See vote counts refresh in real time as the election runs." },
          ].map((f) => (
            <div key={f.title} className="panel p-6">
              <f.icon className="text-accent" size={22} />
              <div className="mt-3 font-display text-xl font-bold">{f.title}</div>
              <p className="mt-2 text-sm text-fg-dim leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Positions / candidates / results */}
        {election ? (
          <section className="mt-12">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <h2 className="font-display text-2xl font-bold">Ballot & Live Results</h2>
              <span className="label">{totalVotes} vote(s) recorded</span>
            </div>
            {positions.length === 0 ? (
              <div className="panel p-8 mt-6 text-center text-fg-dim">
                The admin hasn't added any positions yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-6">
                {positions.map((p) => {
                  const list = candidates.filter((c) => c.position_id === p.id);
                  const posTotal = list.reduce((a, c) => a + (results.find((r) => r.candidate_id === c.id)?.votes ?? 0), 0);
                  const maxVotes = Math.max(0, ...list.map((c) => results.find((r) => r.candidate_id === c.id)?.votes ?? 0));
                  return (
                    <div key={p.id} className="panel p-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <div className="font-display text-xl font-bold">{p.name}</div>
                          {p.description && <div className="text-sm text-fg-dim mt-1">{p.description}</div>}
                        </div>
                        <span className="label">{posTotal} vote(s)</span>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {list.length === 0 && <div className="text-sm text-fg-dim">No candidates yet.</div>}
                        {list.map((c) => {
                          const v = results.find((r) => r.candidate_id === c.id)?.votes ?? 0;
                          const pct = posTotal > 0 ? (v / posTotal) * 100 : 0;
                          const isLeader = maxVotes > 0 && v === maxVotes;
                          return (
                            <div
                              key={c.id}
                              className={`border p-3 transition-colors ${isLeader ? "border-accent bg-bg-2" : "border-line-dim hover:border-line"}`}
                            >
                              <div className="flex items-center gap-3">
                                <img src={c.photo_url} alt={c.name} className="w-11 h-11 border border-line object-cover" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{c.name}</div>
                                    {isLeader && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-accent text-accent label" style={{ fontSize: "0.6rem" }}>
                                        <Trophy size={10} /> Leading
                                      </span>
                                    )}
                                  </div>
                                  {c.bio && <div className="text-xs text-fg-dim truncate">{c.bio}</div>}
                                </div>
                                <div className="datum text-sm text-right">
                                  <div className={isLeader ? "text-accent font-bold" : ""}>{v}</div>
                                  <div className="text-xs text-fg-dim">{pct.toFixed(1)}%</div>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 bg-bg-2 border border-line-dim">
                                <div className={`h-full transition-all ${isLeader ? "bg-accent" : "bg-fg-mute"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </section>
        ) : (
          <section className="mt-12 panel p-10 text-center">
            <div className="label">Awaiting election</div>
            <h2 className="mt-4 font-display text-2xl">No election has been created yet</h2>
            <p className="mt-2 text-fg-dim">Sign in as admin to create an election, add positions, and issue tickets.</p>
            <Link to="/auth" className="btn-primary mt-6 inline-flex">Sign in</Link>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
