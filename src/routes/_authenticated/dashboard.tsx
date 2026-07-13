import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getMe, getMyTicket, claimFirstAdmin } from "@/lib/election.functions";
import { Ticket, ShieldCheck, ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const getMeFn = useServerFn(getMe);
  const getMyTicketFn = useServerFn(getMyTicket);
  const claimAdminFn = useServerFn(claimFirstAdmin);

  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn(), staleTime: 15_000 });
  const t = useQuery({ queryKey: ["my-ticket"], queryFn: () => getMyTicketFn(), refetchInterval: 8_000 });

  const [copied, setCopied] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  async function claim() {
    setClaiming(true); setClaimErr(null);
    try { await claimAdminFn(); await me.refetch(); }
    catch (e) { setClaimErr(e instanceof Error ? e.message : String(e)); }
    finally { setClaiming(false); }
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const election = t.data?.election;
  const ticket = t.data?.ticket;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-5 lg:px-10 py-10">
        <div className="label">Signed in as</div>
        <h1 className="mt-2 font-display text-3xl font-black">{me.data?.profile?.full_name || me.data?.profile?.email || "Voter"}</h1>
        <div className="mt-1 text-sm text-fg-dim">{me.data?.profile?.email}</div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Ticket card */}
          <div className="panel p-6">
            <div className="flex items-center gap-2 label"><Ticket size={14} /> Voting Ticket</div>
            {!election ? (
              <div className="mt-4 text-fg-dim">No election is currently active. Check back when the admin opens voting.</div>
            ) : !ticket ? (
              <div className="mt-4">
                <div className="text-sm">Election: <span className="text-fg font-medium">{election.title}</span></div>
                <div className="mt-3 border border-warn p-3 text-sm text-warn">
                  The admin hasn't issued you a ticket for this election yet.
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-sm">Election: <span className="text-fg font-medium">{election.title}</span></div>
                <div className="mt-3 label">Your one-time code</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 font-mono text-3xl font-bold tracking-[0.2em] border border-accent p-4 text-center text-accent bg-bg-2">
                    {ticket.code}
                  </div>
                  <button className="btn h-full" onClick={() => copy(ticket.code)} aria-label="Copy code">
                    {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="mt-3 text-xs text-fg-dim">
                  Status: <span className={ticket.status === "active" ? "text-ok" : ticket.status === "used" ? "text-fg-dim" : "text-danger"}>{ticket.status}</span>
                </div>
                {ticket.status === "active" && (
                  <Link to="/vote" className="btn-primary w-full mt-4">
                    Cast your vote <ArrowRight size={16} />
                  </Link>
                )}
                {ticket.status === "used" && (
                  <div className="mt-4 border border-ok p-3 text-sm text-ok">You've already voted in this election. Thank you.</div>
                )}
                {ticket.status === "terminated" && (
                  <div className="mt-4 border border-danger p-3 text-sm text-danger">This code is terminated (election closed).</div>
                )}
              </div>
            )}
          </div>

          {/* Roles / admin */}
          <div className="panel p-6">
            <div className="flex items-center gap-2 label"><ShieldCheck size={14} /> Account</div>
            <div className="mt-4 space-y-2">
              <div className="text-sm">Roles: <span className="datum">{(me.data?.roles ?? []).join(", ") || "none"}</span></div>
              {me.data?.isAdmin ? (
                <Link to="/admin" className="btn-primary mt-4 inline-flex">
                  Go to admin panel <ArrowRight size={14} />
                </Link>
              ) : (
                <div className="mt-4 border border-line-dim p-4">
                  <div className="label mb-2">First-time setup</div>
                  <p className="text-sm text-fg-dim">
                    If no admin has been assigned yet, you can claim admin rights (only works if the system has no admin).
                  </p>
                  <button onClick={claim} disabled={claiming} className="btn mt-3">
                    {claiming ? "Claiming…" : "Claim admin (if unassigned)"}
                  </button>
                  {claimErr && <div className="mt-3 text-sm text-danger">{claimErr}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
