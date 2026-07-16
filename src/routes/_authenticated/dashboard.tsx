import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getMe, getMyTicket, getPublicResults } from "@/lib/election.functions";
import { Ticket, ShieldCheck, ArrowRight, Copy, Check, UserCircle2, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Trophy, BarChart2 } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const getMeFn = useServerFn(getMe);
  const getMyTicketFn = useServerFn(getMyTicket);
  const getResultsFn = useServerFn(getPublicResults);

  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn(), staleTime: 15_000 });
  const t = useQuery({ queryKey: ["my-ticket"], queryFn: () => getMyTicketFn(), refetchInterval: 8_000 });
  const results = useQuery({ queryKey: ["public-results"], queryFn: () => getResultsFn(), refetchInterval: 10_000 });

  const [copied, setCopied] = useState(false);
  const [posFilter, setPosFilter] = useState<string>("all");

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const election = t.data?.election;
  const ticket = t.data?.ticket;
  const profile = me.data?.profile;
  const isAdmin = me.data?.isAdmin;

  const liveElection = results.data?.election;
  const livePositions = results.data?.positions ?? [];
  const liveCandidates = results.data?.candidates ?? [];
  const liveResults = results.data?.results ?? [];
  const totalVotes = results.data?.totalVotes ?? 0;
  const totalTickets = results.data?.totalTickets ?? 0;
  const turnout = totalTickets > 0 ? (totalVotes / totalTickets) * 100 : 0;

  const chartByPos = useMemo(() => {
    return livePositions.map((p) => ({
      position: p,
      data: liveCandidates
        .filter((c) => c.position_id === p.id)
        .map((c) => ({
          name: c.name,
          votes: liveResults.find((r) => r.candidate_id === c.id)?.votes ?? 0,
        }))
        .sort((a, b) => b.votes - a.votes),
    }));
  }, [livePositions, liveCandidates, liveResults]);

  const ticketStatusColor = ticket?.status === "active" ? "text-ok border-ok" : ticket?.status === "used" ? "text-fg-dim border-line" : "text-danger border-danger";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 lg:px-10 py-12">

        {/* Profile header */}
        <div className="flex items-center gap-5 border-b border-line pb-8">
          <div className="w-16 h-16 border border-line bg-bg-2 flex items-center justify-center flex-shrink-0">
            <UserCircle2 size={32} className="text-fg-dim" />
          </div>
          <div>
            <div className="label text-xs mb-1">Signed in as</div>
            <h1 className="font-display text-2xl font-black leading-tight">{profile?.full_name || "Voter"}</h1>
            <div className="text-sm text-fg-dim mt-0.5">{profile?.email}</div>
          </div>
          {isAdmin && (
            <div className="ml-auto">
              <Link to="/admin" className="btn-primary">
                Admin Console <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          {/* Ticket card */}
          <div className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line bg-bg-2 flex items-center gap-2">
              <Ticket size={15} className="text-accent" />
              <span className="label text-xs">Voting Ticket</span>
            </div>
            <div className="p-6">
              {!election ? (
                <div className="py-6 text-center">
                  <AlertTriangle size={28} className="mx-auto text-fg-mute mb-3" />
                  <p className="text-fg-dim text-sm">No election is currently active.</p>
                  <p className="text-fg-mute text-xs mt-1">Check back when the admin opens voting.</p>
                </div>
              ) : !ticket ? (
                <div className="py-4">
                  <div className="text-sm mb-3">Election: <span className="text-fg font-semibold">{election.title}</span></div>
                  <div className="border border-warn/40 bg-warn/5 p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-warn flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warn">The admin hasn't issued you a ticket for this election yet. Please wait.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm mb-4">Election: <span className="text-fg font-semibold">{election.title}</span></div>

                  <div className="label text-xs mb-2">Your one-time code</div>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 font-mono text-3xl font-black tracking-[0.25em] border border-accent p-5 text-center text-accent bg-accent/5">
                      {ticket.code}
                    </div>
                    <button className="btn px-4" onClick={() => copy(ticket.code)} aria-label="Copy code">
                      {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 border text-xs label ${ticketStatusColor}`}>
                    {ticket.status === "active" && <CheckCircle2 size={12} />}
                    {ticket.status === "used" && <Check size={12} />}
                    {ticket.status === "terminated" && <XCircle size={12} />}
                    {ticket.status.toUpperCase()}
                  </div>

                  {ticket.status === "active" && (
                    <Link to="/vote" className="btn-primary w-full mt-5">
                      Cast your vote <ArrowRight size={16} />
                    </Link>
                  )}
                  {ticket.status === "used" && (
                    <div className="mt-4 border border-ok/40 bg-ok/5 p-4 flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-ok flex-shrink-0" />
                      <p className="text-sm text-ok">You've already voted in this election. Thank you!</p>
                    </div>
                  )}
                  {ticket.status === "terminated" && (
                    <div className="mt-4 border border-danger/40 bg-danger/5 p-4 flex items-center gap-3">
                      <XCircle size={16} className="text-danger flex-shrink-0" />
                      <p className="text-sm text-danger">This ticket has been terminated (election closed).</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Account card */}
          <div className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line bg-bg-2 flex items-center gap-2">
              <ShieldCheck size={15} className="text-accent" />
              <span className="label text-xs">Account & Roles</span>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between border border-line-dim p-3">
                  <span className="label text-xs">Full name</span>
                  <span className="text-sm font-medium">{profile?.full_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between border border-line-dim p-3">
                  <span className="label text-xs">Email</span>
                  <span className="text-sm text-fg-dim truncate max-w-[200px]">{profile?.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between border border-line-dim p-3">
                  <span className="label text-xs">Roles</span>
                  <div className="flex gap-1.5">
                    {(me.data?.roles ?? []).map((r) => (
                      <span key={r} className={`label text-xs px-2 py-0.5 border ${r === "admin" ? "border-accent text-accent" : "border-line text-fg-dim"}`}>
                        {r}
                      </span>
                    ))}
                    {(me.data?.roles ?? []).length === 0 && <span className="text-sm text-fg-dim">none</span>}
                  </div>
                </div>
              </div>

              {!isAdmin && (
                <div className="mt-5 border border-line-dim p-4">
                  <div className="label text-xs mb-2">Need admin access?</div>
                  <p className="text-sm text-fg-dim leading-relaxed">
                    Contact an existing admin to be promoted.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Voting Rate Tracker */}
        {liveElection && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <BarChart2 size={18} className="text-accent" />
              <div className="font-display text-xl font-bold">Live Voting Rate</div>
              <div className={`ml-auto label text-xs px-2 py-1 border ${
                liveElection.status === "active" ? "border-accent text-accent" : "border-line text-fg-dim"
              }`}>{liveElection.status?.toUpperCase()}</div>
            </div>

            {/* Turnout summary */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="panel p-4">
                <div className="label text-xs mb-1 flex items-center gap-1.5"><TrendingUp size={12} /> Turnout</div>
                <div className="font-display text-3xl font-black text-accent">{turnout.toFixed(1)}%</div>
                <div className="mt-2 w-full bg-line h-1.5">
                  <div className="h-1.5 bg-accent transition-all duration-700" style={{ width: `${Math.min(turnout, 100)}%` }} />
                </div>
              </div>
              <div className="panel p-4">
                <div className="label text-xs mb-1">Votes Cast</div>
                <div className="font-display text-3xl font-black">{totalVotes}</div>
                <div className="text-xs text-fg-dim mt-1">of {totalTickets} eligible</div>
              </div>
              <div className="panel p-4">
                <div className="label text-xs mb-1">Pending</div>
                <div className="font-display text-3xl font-black text-fg-dim">{Math.max(0, totalTickets - totalVotes)}</div>
                <div className="text-xs text-fg-dim mt-1">haven't voted yet</div>
              </div>
            </div>

            {/* Per-position charts */}
            {livePositions.length > 1 && (
              <div className="flex flex-wrap gap-1 mb-4 items-center">
                <button
                  onClick={() => setPosFilter("all")}
                  className={`px-3 py-1.5 label text-xs border ${
                    posFilter === "all" ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
                  }`}
                >All</button>
                {livePositions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPosFilter(p.id)}
                    className={`px-3 py-1.5 label text-xs border ${
                      posFilter === p.id ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
                    }`}
                  >{p.name}</button>
                ))}
              </div>
            )}
            {chartByPos.filter((c) => posFilter === "all" || c.position.id === posFilter).map(({ position, data }) => {
              const posTotal = data.reduce((s, d) => s + d.votes, 0);
              const winner = data[0];
              return (
                <div key={position.id} className="panel mb-4 overflow-hidden">
                  <div className="px-5 py-3 bg-bg-2 border-b border-line flex items-center justify-between">
                    <div className="font-display font-bold">{position.name}</div>
                    <div className="datum text-xs text-fg-dim">{posTotal} vote{posTotal !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="p-5">
                    {data.length === 0 ? (
                      <div className="text-fg-dim text-sm">No candidates yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {data.map((c, i) => {
                          const pct = posTotal > 0 ? (c.votes / posTotal) * 100 : 0;
                          const isLeading = i === 0 && c.votes > 0;
                          return (
                            <div key={c.name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5 text-sm">
                                  {isLeading && <Trophy size={12} className="text-accent" />}
                                  <span className={isLeading ? "font-semibold" : "text-fg-dim"}>{c.name}</span>
                                </div>
                                <div className="datum text-xs text-fg-dim">{c.votes} · {pct.toFixed(1)}%</div>
                              </div>
                              <div className="w-full bg-line h-2">
                                <div
                                  className="h-2 transition-all duration-700"
                                  style={{ width: `${pct}%`, background: isLeading ? "#B4FF39" : "#3AF0FF" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {winner && winner.votes > 0 && (
                    <div className="px-5 py-2 bg-accent/5 border-t border-accent/30 flex items-center gap-2">
                      <Trophy size={12} className="text-accent" />
                      <span className="label text-xs text-accent">Leading:</span>
                      <span className="text-sm font-semibold text-accent">{winner.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
