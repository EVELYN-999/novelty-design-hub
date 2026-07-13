import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getMyTicket, getPublicElection, castVote } from "@/lib/election.functions";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vote")({
  component: VotePage,
});

function VotePage() {
  const getTicket = useServerFn(getMyTicket);
  const getPub = useServerFn(getPublicElection);
  const cast = useServerFn(castVote);
  const navigate = useNavigate();

  const t = useQuery({ queryKey: ["my-ticket"], queryFn: () => getTicket() });
  const p = useQuery({ queryKey: ["public-election"], queryFn: () => getPub() });

  const [code, setCode] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const positions = p.data?.positions ?? [];
  const candidates = p.data?.candidates ?? [];
  const election = t.data?.election ?? p.data?.election;
  const ticket = t.data?.ticket;

  const prefillCode = useMemo(() => ticket?.code ?? "", [ticket]);
  const effectiveCode = code || prefillCode;
  const complete = positions.length > 0 && positions.every((pos) => selections[pos.id]);

  async function submit() {
    setErr(null); setSubmitting(true);
    try {
      await cast({ data: { code: effectiveCode.trim().toUpperCase(), selections } });
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  }

  if (!election) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <h1 className="font-display text-3xl">No active election</h1>
          <p className="mt-3 text-fg-dim">There's nothing to vote on right now.</p>
          <Link to="/dashboard" className="btn-primary mt-6 inline-flex">Dashboard</Link>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <CheckCircle2 size={64} className="mx-auto text-accent" />
          <h1 className="mt-6 font-display text-3xl font-black">Vote recorded</h1>
          <p className="mt-3 text-fg-dim">Your ballot is sealed. Redirecting to your dashboard…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 lg:px-10 py-10">
        <div className="label">Cast your ballot</div>
        <h1 className="mt-2 font-display text-3xl font-black">{election.title}</h1>
        {election.description && <p className="mt-2 text-fg-dim">{election.description}</p>}

        <div className="mt-8 panel p-6">
          <label className="label block mb-2">Ticket code</label>
          <input
            className="field-lg uppercase text-center tracking-[0.2em]"
            value={code || prefillCode}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={16}
          />
          <div className="mt-2 text-xs text-fg-dim">
            {ticket ? `Prefilled from your issued ticket (${ticket.status}).` : "Enter the code the admin issued you."}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {positions.map((pos) => {
            const list = candidates.filter((c) => c.position_id === pos.id);
            return (
              <div key={pos.id} className="panel p-6">
                <div className="font-display text-xl font-bold">{pos.name}</div>
                {pos.description && <div className="text-sm text-fg-dim mt-1">{pos.description}</div>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {list.length === 0 && <div className="text-sm text-fg-dim">No candidates.</div>}
                  {list.map((c) => {
                    const active = selections[pos.id] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelections((s) => ({ ...s, [pos.id]: c.id }))}
                        className={`text-left p-3 border transition ${active ? "border-accent bg-bg-2" : "border-line-dim hover:border-line"}`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={c.photo_url} alt="" className="w-10 h-10 border border-line object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            {c.bio && <div className="text-xs text-fg-dim truncate">{c.bio}</div>}
                          </div>
                          {active && <CheckCircle2 size={18} className="text-accent" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {err && <div className="mt-6 border border-danger p-3 text-sm text-danger">{err}</div>}
        <div className="mt-8 flex gap-3">
          <button className="btn-primary flex-1" onClick={submit} disabled={submitting || !complete || !effectiveCode}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Seal & Submit Ballot
          </button>
          <Link to="/dashboard" className="btn">Cancel</Link>
        </div>
        {!complete && positions.length > 0 && (
          <div className="mt-3 text-xs text-fg-dim">Select a candidate for every position to enable submission.</div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
