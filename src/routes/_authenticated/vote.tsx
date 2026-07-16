import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getMyTicket, getPublicElection, castVote } from "@/lib/election.functions";
import { CheckCircle2, Loader2, ArrowRight, Ticket, AlertTriangle } from "lucide-react";

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
  const selectedCount = Object.keys(selections).length;

  async function submit() {
    setErr(null); setSubmitting(true);
    try {
      await cast({ data: { code: effectiveCode.trim().toUpperCase(), selections } });
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  }

  if (!election) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-5 py-20 text-center">
          <div className="w-16 h-16 border border-line flex items-center justify-center mx-auto">
            <AlertTriangle size={26} className="text-fg-mute" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">No active election</h1>
          <p className="mt-3 text-fg-dim text-sm">There's nothing to vote on right now.</p>
          <Link to="/dashboard" className="btn-primary mt-8 inline-flex">Back to dashboard</Link>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-5 py-24 text-center">
          <div className="w-20 h-20 border border-accent bg-accent/5 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-accent" />
          </div>
          <h1 className="mt-8 font-display text-3xl font-black">Vote recorded!</h1>
          <p className="mt-3 text-fg-dim">Your ballot has been sealed and recorded. Redirecting to your dashboard…</p>
          <div className="mt-6 h-1 bg-line overflow-hidden">
            <div className="h-full bg-accent animate-[ticker-anim_3s_linear_forwards]" style={{ width: "100%", animation: "progress 3s linear forwards" }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 lg:px-10 py-10">

        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="label text-xs">Cast your ballot</div>
            {(election as any)?.election_type && (
              <span className="label text-xs px-2 py-0.5 border border-accent text-accent">
                {(election as any).election_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-black">{election.title}</h1>
          {election.description && <p className="mt-2 text-fg-dim text-sm">{election.description}</p>}
          {/* Overall progress bar */}
          <div className="mt-4">
            <div className="flex justify-between label text-xs mb-1">
              <span>Ballot completion</span>
              <span className={complete ? "text-accent" : "text-fg-dim"}>{selectedCount} / {positions.length} positions</span>
            </div>
            <div className="w-full bg-line h-2">
              <div
                className="h-2 transition-all duration-500"
                style={{ width: `${positions.length > 0 ? (selectedCount / positions.length) * 100 : 0}%`, background: complete ? "#B4FF39" : "#3AF0FF" }}
              />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 panel p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Ticket size={16} className="text-accent" />
            <div>
              <div className="label text-xs">Ticket code</div>
              <div className="font-mono font-bold text-accent tracking-widest mt-0.5">
                {effectiveCode || "—"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="label text-xs">Progress</div>
            <div className="datum text-sm mt-0.5">
              <span className={complete ? "text-ok" : "text-fg-dim"}>{selectedCount}</span>
              <span className="text-fg-mute"> / {positions.length}</span>
            </div>
          </div>
        </div>

        {/* Position jump nav */}
        {positions.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {positions.map((pos, idx) => {
              const done = !!selections[pos.id];
              return (
                <a
                  key={pos.id}
                  href={`#pos-${pos.id}`}
                  className={`px-3 py-1.5 label text-xs border transition-colors ${
                    done ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
                  }`}
                >
                  {done ? "✓ " : `${idx + 1}. `}{pos.name}
                </a>
              );
            })}
          </div>
        )}

        {/* Ticket code input (only if not prefilled) */}
        {!ticket && (
          <div className="mt-4 panel p-5">
            <label className="label text-xs block mb-2">Enter your ticket code</label>
            <input
              className="field-lg uppercase text-center tracking-[0.25em]"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              maxLength={16}
            />
          </div>
        )}

        {/* Positions */}
        <div className="mt-6 space-y-6">
          {positions.map((pos, idx) => {
            const list = candidates.filter((c) => c.position_id === pos.id);
            const selected = selections[pos.id];
            return (
              <div key={pos.id} id={`pos-${pos.id}`} className={`panel overflow-hidden transition-all ${selected ? "border-accent/50" : ""}`}>
                <div className="px-6 py-4 border-b border-line bg-bg-2 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="label text-xs text-fg-mute">#{idx + 1}</span>
                      <span className="font-display text-lg font-bold">{pos.name}</span>
                    </div>
                    {pos.description && <div className="text-xs text-fg-dim mt-0.5">{pos.description}</div>}
                  </div>
                  {selected ? (
                    <CheckCircle2 size={18} className="text-accent flex-shrink-0" />
                  ) : (
                    <span className="label text-xs text-warn">Select one</span>
                  )}
                </div>
                <div className="p-5 grid gap-3 sm:grid-cols-2">
                  {list.length === 0 && <p className="text-sm text-fg-dim col-span-2 text-center py-4">No candidates for this position.</p>}
                  {list.map((c) => {
                    const active = selections[pos.id] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelections((s) => ({ ...s, [pos.id]: c.id }))}
                        className={`text-left p-4 border transition-all duration-150 ${
                          active ? "border-accent bg-accent/5" : "border-line-dim hover:border-line hover:bg-bg-2"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={c.photo_url} alt="" className="w-12 h-12 border border-line object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{c.name}</div>
                            {c.bio && <div className="text-xs text-fg-dim truncate mt-0.5">{c.bio}</div>}
                          </div>
                          <div className={`w-5 h-5 border flex items-center justify-center flex-shrink-0 transition-all ${active ? "border-accent bg-accent" : "border-line"}`}>
                            {active && <CheckCircle2 size={12} className="text-bg" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {err && (
          <div className="mt-6 border border-danger/50 bg-danger/5 p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{err}</p>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            className="btn-primary flex-1"
            onClick={submit}
            disabled={submitting || !complete || !effectiveCode}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {submitting ? "Submitting…" : "Seal & Submit Ballot"}
          </button>
          <Link to="/dashboard" className="btn">Cancel</Link>
        </div>

        {!complete && positions.length > 0 && (
          <p className="mt-3 text-xs text-fg-dim text-center">
            Select a candidate for every position ({positions.length - selectedCount} remaining) to enable submission.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
