import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  LineChart, Line,
} from "recharts";
import {
  Lock, LogOut, Plus, Trash2, ShieldAlert, Radio, Activity, AlertCircle, KeyRound,
} from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { accentFor } from "@/lib/election-data";
import {
  getBallot, getLedger, getStats, getAuditLog,
  adminVerify, adminAddCandidate, adminRemoveCandidate, adminAddPosition, adminLockElection,
} from "@/lib/election.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin Console — ELECTION/NODE" },
      { name: "description", content: "Restricted: ballot manager, live analytics, and election lock." },
    ],
  }),
});

const STORAGE_KEY = "adminPasscode";

function AdminPage() {
  const [passcode, setPasscode] = useState<string>("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (cached) { setPasscode(cached); setAuthed(true); }
  }, []);

  const verifyFn = useServerFn(adminVerify);
  const verifyM = useMutation({
    mutationFn: (code: string) => verifyFn({ data: { passcode: code } }),
    onSuccess: () => {
      sessionStorage.setItem(STORAGE_KEY, passcode);
      setAuthed(true);
    },
  });

  function signOut() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPasscode(""); setAuthed(false);
  }

  if (!authed) {
    return (
      <div className="min-h-screen">
        <Masthead compact />
        <main className="mx-auto max-w-[560px] px-5 lg:px-10 py-16">
          <div className="label-on">§ Restricted access</div>
          <h2 className="mt-3 font-display font-black text-4xl tracking-[-0.03em]">
            Admin <span className="text-accent">console.</span>
          </h2>
          <p className="mt-3 text-fg-dim">
            Enter the admin passcode. Default demo passcode: <span className="mono text-fg">ADMIN-2026</span>.
          </p>
          <div className="mt-8 panel p-6">
            <label htmlFor="pc" className="label flex items-center gap-2">
              <KeyRound size={12} /> Passcode
            </label>
            <input id="pc" autoFocus type="password" value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyM.mutate(passcode)}
              className="field-lg mt-2" placeholder="••••••••" />
            {verifyM.error && (
              <div className="mt-3 flex gap-2 items-center text-danger text-sm">
                <AlertCircle size={14} /> {String((verifyM.error as Error).message)}
              </div>
            )}
            <button onClick={() => verifyM.mutate(passcode)}
              disabled={!passcode || verifyM.isPending}
              className="btn-primary hover:btn-primary-hover mt-6 w-full disabled:opacity-50">
              {verifyM.isPending ? "Verifying…" : "Unlock console"}
            </button>
          </div>
        </main>
        <Colophon />
      </div>
    );
  }

  return <Console passcode={passcode} onSignOut={signOut} />;
}

function Console({ passcode, onSignOut }: { passcode: string; onSignOut: () => void }) {
  const qc = useQueryClient();
  const getBallotFn = useServerFn(getBallot);
  const getStatsFn = useServerFn(getStats);
  const getLedgerFn = useServerFn(getLedger);
  const getAuditFn = useServerFn(getAuditLog);
  const addCandFn = useServerFn(adminAddCandidate);
  const rmCandFn = useServerFn(adminRemoveCandidate);
  const addPosFn = useServerFn(adminAddPosition);
  const lockFn = useServerFn(adminLockElection);

  const ballot = useQuery({ queryKey: ["ballot"], queryFn: () => getBallotFn(), refetchInterval: 6000 });
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getStatsFn(), refetchInterval: 4000 });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => getLedgerFn(), refetchInterval: 6000 });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => getAuditFn(), refetchInterval: 8000 });

  const positions = ballot.data?.positions ?? [];
  const candidates = ballot.data?.candidates ?? [];
  const election = ballot.data?.election;
  const locked = !!election?.locked;

  const entries = (ledger.data?.entries ?? []) as Array<{ selections: Record<string, string>; created_at: string; entry_index: number }>;

  // Analytics
  const votesPerCandidate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const [, cid] of Object.entries(e.selections)) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return candidates.map((c) => ({ id: c.id, name: c.name, position: positions.find((p) => p.id === c.position_id)?.name ?? "", votes: counts.get(c.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [entries, candidates, positions]);

  const turnoutSeries = useMemo(() => {
    // Cumulative ballots over time bucketed by 5 minutes
    if (entries.length === 0) return [];
    const sorted = [...entries].sort((a, b) => a.entry_index - b.entry_index);
    return sorted.map((e, i) => ({
      t: new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      cumulative: i + 1,
    }));
  }, [entries]);

  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* Header */}
        <div className="py-8 border-b border-line flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="label-on flex items-center gap-2">
              <Radio size={12} className="animate-pulse" /> Admin console
            </div>
            <h2 className="mt-2 font-display font-black text-3xl md:text-5xl tracking-[-0.03em]">
              Ballot manager<span className="text-accent">.</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {locked ? (
              <div className="border border-accent text-accent px-3 py-1.5 label flex items-center gap-2">
                <Lock size={12} /> Ballot locked · {election?.locked_at && new Date(election.locked_at).toLocaleString()}
              </div>
            ) : (
              <div className="border border-warn text-warn px-3 py-1.5 label">◇ Editable</div>
            )}
            <button onClick={onSignOut} className="btn hover:border-danger hover:text-danger">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* KPI row */}
        <section className="border-b border-line grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
          <Kpi label="Ballots cast" value={stats.data?.castCount?.toString() ?? "—"} />
          <Kpi label="Eligible" value={stats.data?.eligible?.toString() ?? "—"} />
          <Kpi label="Turnout" value={
            stats.data && stats.data.eligible > 0
              ? `${((stats.data.castCount / stats.data.eligible) * 100).toFixed(1)}%`
              : "—"
          } accent />
          <Kpi label="Chain length" value={entries.length.toString()} />
        </section>

        {/* Charts */}
        <section className="border-b border-line grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="label-on flex items-center gap-2"><Activity size={12} /> Votes per candidate</div>
              <div className="label">Live</div>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={votesPerCandidate} margin={{ top: 10, right: 20, bottom: 60, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9A9AA3", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    angle={-30} textAnchor="end" interval={0} stroke="#26262E" />
                  <YAxis tick={{ fill: "#9A9AA3", fontSize: 11, fontFamily: "JetBrains Mono" }} stroke="#26262E" allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(180,255,57,0.08)" }}
                    contentStyle={{ background: "#14141B", border: "1px solid #26262E", color: "#EDEDEF", fontFamily: "JetBrains Mono", fontSize: 12, borderRadius: 0 }} />
                  <Bar dataKey="votes" fill="#B4FF39">
                    {votesPerCandidate.map((c) => (
                      <Cell key={c.id} fill={accentFor(c.id).replace(/oklch\(([^)]+)\)/, "oklch($1)")} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="label-on flex items-center gap-2"><Activity size={12} /> Cumulative turnout</div>
              <div className="label">Real-time</div>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={turnoutSeries} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <XAxis dataKey="t" tick={{ fill: "#9A9AA3", fontSize: 11, fontFamily: "JetBrains Mono" }} stroke="#26262E" />
                  <YAxis tick={{ fill: "#9A9AA3", fontSize: 11, fontFamily: "JetBrains Mono" }} stroke="#26262E" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#14141B", border: "1px solid #26262E", color: "#EDEDEF", fontFamily: "JetBrains Mono", fontSize: 12, borderRadius: 0 }} />
                  <Line type="stepAfter" dataKey="cumulative" stroke="#B4FF39" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Ballot manager */}
        <section className="py-10 border-b border-line">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-black text-2xl md:text-3xl">Ballot manager</h3>
            {locked && (
              <div className="border border-accent text-accent px-3 py-1.5 label flex items-center gap-2">
                <ShieldAlert size={12} /> Read-only · locked
              </div>
            )}
          </div>

          {!locked && (
            <AddPositionForm passcode={passcode} onDone={() => qc.invalidateQueries({ queryKey: ["ballot"] })}
              submit={(name, description) => addPosFn({ data: { passcode, name, description } })} />
          )}

          <div className="mt-8 space-y-10">
            {positions.map((pos) => {
              const cands = candidates.filter((c) => c.position_id === pos.id);
              return (
                <div key={pos.id} className="panel p-6">
                  <div className="flex items-baseline justify-between border-b border-line pb-3 mb-4">
                    <div>
                      <div className="label">Position</div>
                      <h4 className="mt-1 font-display font-black text-xl">{pos.name}</h4>
                      <p className="text-fg-dim text-sm mt-1">{pos.description}</p>
                    </div>
                    <div className="label">{cands.length} candidates</div>
                  </div>

                  <ul className="divide-y divide-line">
                    {cands.map((c) => (
                      <li key={c.id} className="flex items-center gap-4 py-3">
                        <div className="h-10 w-10 border border-line flex items-center justify-center mono font-bold text-bg text-sm"
                          style={{ background: accentFor(c.id) }}>
                          {c.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">{c.name}</div>
                          <div className="text-xs text-fg-dim truncate">{c.bio}</div>
                        </div>
                        {!locked && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${c.name}?`)) {
                                rmCandFn({ data: { passcode, candidate_id: c.id } })
                                  .then(() => qc.invalidateQueries({ queryKey: ["ballot"] }))
                                  .catch((e) => alert(e.message));
                              }
                            }}
                            className="btn hover:border-danger hover:text-danger">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!locked && (
                    <AddCandidateForm
                      submit={(name, bio, photo_url) =>
                        addCandFn({ data: { passcode, position_id: pos.id, name, bio, photo_url } })
                      }
                      onDone={() => qc.invalidateQueries({ queryKey: ["ballot"] })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lock */}
        {!locked && (
          <section className="py-10 border-b border-line">
            <div className="panel-accent p-6 md:p-8 flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="label-on flex items-center gap-2"><Lock size={12} /> Terminal action</div>
                <h3 className="mt-2 font-display font-black text-2xl md:text-3xl">Lock the election.</h3>
                <p className="mt-2 text-fg-dim">
                  This computes and publishes the ballot hash, then permanently prevents further edits to
                  positions and candidates. Enforced at the database — not just the UI.
                </p>
              </div>
              <button onClick={() => {
                if (!confirm("LOCK the election? This cannot be undone.")) return;
                lockFn({ data: { passcode } })
                  .then(() => qc.invalidateQueries())
                  .catch((e) => alert(e.message));
              }} className="btn-danger hover:bg-danger hover:text-bg">
                <Lock size={14} /> Lock election
              </button>
            </div>
          </section>
        )}

        {/* Audit log */}
        <section className="py-10">
          <h3 className="font-display font-black text-2xl md:text-3xl mb-4">Audit log</h3>
          <div className="panel divide-y divide-line">
            {(audit.data?.entries ?? []).length === 0 && (
              <div className="p-4 text-fg-dim text-sm">No admin activity recorded.</div>
            )}
            {(audit.data?.entries ?? []).map((r) => (
              <div key={r.id} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="label mono">{new Date(r.created_at).toLocaleString()}</div>
                <div className="mono text-sm">{r.actor}</div>
                <div className="mono text-sm text-accent">{r.action}</div>
                <div className="mono text-xs text-fg-dim break-all">{JSON.stringify(r.detail)}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Colophon />
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-6">
      <div className="label">{label}</div>
      <div className={`mt-2 mono font-bold ${accent ? "text-accent" : "text-fg"} text-4xl`}>{value}</div>
    </div>
  );
}

function AddPositionForm({ passcode: _pc, submit, onDone }: { passcode: string; submit: (n: string, d: string) => Promise<unknown>; onDone: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel p-4 grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
      <div>
        <label className="label">New position</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Secretary" className="field mt-1" />
      </div>
      <div>
        <label className="label">Description</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Keeper of records." className="field mt-1" />
      </div>
      <button disabled={!name.trim() || busy} onClick={async () => {
        setErr(null); setBusy(true);
        try { await submit(name.trim(), desc.trim()); setName(""); setDesc(""); onDone(); }
        catch (e) { setErr((e as Error).message); }
        finally { setBusy(false); }
      }} className="btn hover:border-accent hover:text-accent">
        <Plus size={14} /> Add position
      </button>
      {err && <div className="md:col-span-3 text-danger text-sm flex gap-2"><AlertCircle size={14} /> {err}</div>}
    </div>
  );
}

function AddCandidateForm({ submit, onDone }: { submit: (n: string, b: string, u: string) => Promise<unknown>; onDone: () => void }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [url, setUrl] = useState("https://api.dicebear.com/9.x/notionists/svg?seed=" + Math.random().toString(36).slice(2, 8));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="label mb-2 flex items-center gap-2"><Plus size={12} /> Add candidate</div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="field" />
        <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio (max 300)" className="field" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Photo URL (https://…)" className="field" />
        <button disabled={!name.trim() || !url.trim() || busy} onClick={async () => {
          setErr(null); setBusy(true);
          try { await submit(name.trim(), bio.trim(), url.trim()); setName(""); setBio(""); onDone(); }
          catch (e) { setErr((e as Error).message); }
          finally { setBusy(false); }
        }} className="btn hover:border-accent hover:text-accent">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {err && <div className="mt-2 text-danger text-sm flex gap-2"><AlertCircle size={14} /> {err}</div>}
    </div>
  );
}
