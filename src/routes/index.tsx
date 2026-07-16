import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getPublicElection } from "@/lib/election.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ShieldCheck, Ticket, BarChart3, Trophy, Users, Radio, Lock, Filter } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "VoteWise — Live Elections & Results" },
      { name: "description", content: "VoteWise — Secure digital ballot system. See live elections, candidates, and real-time vote counts." },
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

  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setLoggedIn(!!s?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  const totalVotes = results.reduce((a, r) => a + r.votes, 0);
  const isActive = election?.status === "active";
  const isEnded = election?.status === "ended";
  const [posFilter, setPosFilter] = useState<string>("all");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10 py-10 space-y-10">

        {/* Hero */}
        <section className="relative overflow-hidden border border-line bg-panel">
          <div className={`h-1 w-full ${isActive ? "bg-accent" : isEnded ? "bg-danger" : "bg-line"}`} />
          <div className="p-8 md:p-14">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 border label text-xs font-bold ${
                isActive ? "border-accent text-accent bg-accent/5"
                : isEnded ? "border-danger text-danger bg-danger/5"
                : "border-line text-fg-dim"
              }`}>
                {isActive && <Radio size={11} className="animate-pulse" />}
                {isActive ? "LIVE · ELECTION ACTIVE" : isEnded ? "ELECTION ENDED" : election ? "DRAFT" : "AWAITING ELECTION"}
              </span>
            </div>

            <h1 className="font-display font-black text-[clamp(2.2rem,5.5vw,4rem)] leading-[1.05] tracking-tight max-w-4xl">
              {election?.title ?? "No election is currently running"}
            </h1>

            {election?.description && (
              <p className="mt-5 max-w-2xl text-fg-dim text-lg leading-relaxed">{election.description}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {loggedIn ? (
                <>
                  <Link to="/dashboard" className="btn-primary">
                    My dashboard <ArrowRight size={16} />
                  </Link>
                  <Link to="/vote" className="btn">Cast vote</Link>
                </>
              ) : (
                <>
                  <Link to="/auth" className="btn-primary">
                    Sign up to vote <ArrowRight size={16} />
                  </Link>
                  <Link to="/auth" className="btn">Sign in</Link>
                </>
              )}
            </div>

            {election && (
              <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-px bg-line border border-line">
                {[
                  { label: "Votes Cast", value: totalVotes, accent: true, icon: <Users size={13} /> },
                  { label: "Positions", value: positions.length, accent: false, icon: null },
                  { label: "Candidates", value: candidates.length, accent: false, icon: null },
                ].map((s) => (
                  <div key={s.label} className="bg-bg-2 p-5">
                    <div className="label flex items-center gap-1.5 text-xs">{s.icon}{s.label}</div>
                    <div className={`datum text-4xl font-black mt-2 ${s.accent ? "text-accent" : "text-fg"}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Ticket, title: "Admin-issued tickets", body: "Each voter receives a unique one-time code, valid only for the current election. No ticket, no vote." },
            { icon: ShieldCheck, title: "One vote per ticket", body: "Every ticket casts exactly one ballot. Codes are permanently terminated the moment the election ends." },
            { icon: BarChart3, title: "Live results", body: "Vote counts refresh in real time as the election runs. Watch the race unfold live on this page." },
          ].map((f) => (
            <div key={f.title} className="panel p-7 group hover:border-accent transition-colors duration-200">
              <div className="w-11 h-11 border border-line group-hover:border-accent flex items-center justify-center transition-colors">
                <f.icon className="text-accent" size={20} />
              </div>
              <div className="mt-5 font-display text-lg font-bold">{f.title}</div>
              <p className="mt-2 text-sm text-fg-dim leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Live ballot */}
        {election ? (
          <section>
            <div className="flex flex-wrap items-center justify-between border-b border-line pb-4 gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">Ballot & Live Results</h2>
                <p className="text-sm text-fg-dim mt-1">{election.title}</p>
              </div>
              <span className="label text-xs">{totalVotes} vote{totalVotes !== 1 ? "s" : ""} recorded</span>
            </div>

            {/* Position filter tabs */}
            {positions.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-1 items-center">
                <Filter size={12} className="text-fg-mute mr-1" />
                <button
                  onClick={() => setPosFilter("all")}
                  className={`px-3 py-1.5 label text-xs border ${
                    posFilter === "all" ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
                  }`}
                >
                  All positions
                </button>
                {positions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPosFilter(p.id)}
                    className={`px-3 py-1.5 label text-xs border ${
                      posFilter === p.id ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {positions.length === 0 ? (
              <div className="panel p-12 mt-6 text-center">
                <Ticket size={36} className="mx-auto mb-4 text-fg-mute" />
                <p className="text-fg-dim">No positions have been added yet.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {positions.filter((p) => posFilter === "all" || p.id === posFilter).map((p) => {
                  const list = candidates.filter((c) => c.position_id === p.id);
                  const posTotal = list.reduce((a, c) => a + (results.find((r) => r.candidate_id === c.id)?.votes ?? 0), 0);
                  const maxVotes = Math.max(0, ...list.map((c) => results.find((r) => r.candidate_id === c.id)?.votes ?? 0));
                  return (
                    <div key={p.id} className="panel overflow-hidden">
                      <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-bg-2">
                        <div>
                          <div className="font-display text-xl font-bold">{p.name}</div>
                          {p.description && <div className="text-sm text-fg-dim mt-0.5">{p.description}</div>}
                        </div>
                        <span className="label text-xs">{posTotal} vote{posTotal !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="p-6 grid gap-3">
                        {list.length === 0 && <p className="text-sm text-fg-dim text-center py-4">No candidates yet.</p>}
                        {list.map((c) => {
                          const v = results.find((r) => r.candidate_id === c.id)?.votes ?? 0;
                          const pct = posTotal > 0 ? (v / posTotal) * 100 : 0;
                          const isLeader = maxVotes > 0 && v === maxVotes;
                          return (
                            <div key={c.id} className={`border p-4 transition-all ${isLeader ? "border-accent bg-accent/5" : "border-line-dim hover:border-line"}`}>
                              <div className="flex items-center gap-4">
                                <img src={c.photo_url} alt={c.name} className="w-14 h-14 border border-line object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-base">{c.name}</span>
                                    {isLeader && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-accent text-accent label" style={{ fontSize: "0.6rem" }}>
                                        <Trophy size={9} /> LEADING
                                      </span>
                                    )}
                                  </div>
                                  {c.bio && <div className="text-xs text-fg-dim mt-0.5 truncate">{c.bio}</div>}
                                  <div className="mt-2.5 h-1.5 bg-bg border border-line-dim overflow-hidden">
                                    <div className={`h-full transition-all duration-700 ${isLeader ? "bg-accent" : "bg-fg-mute"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                                <div className="datum text-right flex-shrink-0 pl-2">
                                  <div className={`text-2xl font-black ${isLeader ? "text-accent" : "text-fg"}`}>{v}</div>
                                  <div className="text-xs text-fg-dim">{pct.toFixed(1)}%</div>
                                </div>
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
          <section className="panel p-14 text-center">
            <div className="w-16 h-16 border border-line flex items-center justify-center mx-auto">
              <Lock size={26} className="text-fg-mute" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">No election is running</h2>
            <p className="mt-3 text-fg-dim max-w-sm mx-auto text-sm leading-relaxed">
              {loggedIn
                ? "The admin hasn't started an election yet. Check back soon."
                : "Sign in as admin to create an election, add positions, candidates, and issue voter tickets."}
            </p>
            {loggedIn ? (
              <Link to="/dashboard" className="btn-primary mt-8 inline-flex">Go to dashboard</Link>
            ) : (
              <Link to="/auth" className="btn-primary mt-8 inline-flex">Get started</Link>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
