import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import {
  getMe, adminListElections, adminCreateElection, adminActivateElection,
  adminEndElection, adminDeleteElection, adminGetElection, adminAddPosition,
  adminRemovePosition, adminAddCandidate, adminRemoveCandidate, adminListUsers,
  adminIssueTickets, adminIssueAllTickets, adminRevokeTicket, adminGetElectionHistory,
  adminPromoteUser, adminDemoteUser,
} from "@/lib/election.functions";
import {
  adminUploadVoters, adminListEligibleVoters,
  adminEditEligibleVoter, adminRemoveEligibleVoter,
} from "@/lib/voter.functions";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import { Loader2, Plus, Trash2, Play, Square, Ticket, UserPlus, ShieldOff, RefreshCw, Trophy, TrendingUp, Users, CheckCircle2, History, Clock, ShieldCheck, ShieldX, Search, Upload, Link2, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "elections" | "ballot" | "voters" | "tickets" | "analytics" | "history";

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMeFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  useEffect(() => {
    if (me.data && !me.data.isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [me.data, navigate]);

  const [tab, setTab] = useState<Tab>("elections");
  const [selectedEl, setSelectedEl] = useState<string | null>(null);

  const listFn = useServerFn(adminListElections);
  const list = useQuery({
    queryKey: ["admin-elections"], queryFn: () => listFn(),
    enabled: !!me.data?.isAdmin, refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!selectedEl && list.data?.elections?.length) {
      const active = list.data.elections.find((e) => e.status === "active") ?? list.data.elections[0];
      setSelectedEl(active.id);
    }
  }, [list.data, selectedEl]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-elections"] });
    qc.invalidateQueries({ queryKey: ["admin-election-detail"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["public-election"] });
  };

  if (me.isLoading) {
    return (
      <div className="min-h-screen"><SiteHeader />
        <main className="mx-auto max-w-md py-20 text-center"><Loader2 className="mx-auto animate-spin" /></main>
      </div>
    );
  }
  if (!me.data?.isAdmin) return null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-5 lg:px-10 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="label">Admin Console</div>
            <h1 className="mt-2 font-display text-3xl font-black">Election Management</h1>
          </div>
          <button className="btn" onClick={invalidateAll}><RefreshCw size={14} /> Refresh</button>
        </div>

        {/* Election picker */}
        <ElectionPicker
          elections={list.data?.elections ?? []}
          selectedId={selectedEl}
          onSelect={(id) => setSelectedEl(id)}
          onChanged={invalidateAll}
        />

        {/* Tabs */}
        <div className="mt-8 border-b border-line flex gap-1 overflow-x-auto">
          {(["elections", "ballot", "voters", "tickets", "analytics", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 label whitespace-nowrap ${tab === t ? "label-on border-b border-b-accent -mb-px bg-bg-2" : "hover:text-accent"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "elections" && (
            <ElectionsTab
              elections={list.data?.elections ?? []}
              onChanged={invalidateAll}
              onSelect={setSelectedEl}
            />
          )}
          {selectedEl && tab === "ballot" && (
            <BallotTab electionId={selectedEl} onChanged={invalidateAll} />
          )}
          {selectedEl && tab === "voters" && (
            <VotersTab electionId={selectedEl} />
          )}
          {selectedEl && tab === "tickets" && (
            <TicketsTab electionId={selectedEl} onChanged={invalidateAll} />
          )}
          {selectedEl && tab === "analytics" && (
            <AnalyticsTab electionId={selectedEl} />
          )}
          {tab === "history" && <HistoryTab />}
          {!selectedEl && tab !== "elections" && tab !== "history" && tab !== "voters" && (
            <div className="panel p-6 text-fg-dim">Select an election above.</div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ElectionPicker({
  elections, selectedId, onSelect,
}: {
  elections: { id: string; title: string; status: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  if (elections.length === 0) return null;
  return (
    <div className="mt-6 panel p-4 flex flex-wrap items-center gap-3">
      <div className="label">Working election:</div>
      <select
        className="field max-w-md"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        {elections.map((e) => (
          <option key={e.id} value={e.id}>{e.title} — {e.status}</option>
        ))}
      </select>
    </div>
  );
}

const ELECTION_TYPES = [
  { value: "general",        label: "General Election" },
  { value: "executive",      label: "Executive / Leadership" },
  { value: "board",          label: "Board of Directors" },
  { value: "union",          label: "Workers Union" },
  { value: "departmental",   label: "Departmental Vote" },
  { value: "committee",      label: "Committee Election" },
  { value: "other",          label: "Other" },
] as const;

type ElectionType = typeof ELECTION_TYPES[number]["value"];

function ElectionsTab({
  elections, onChanged, onSelect,
}: {
  elections: { id: string; title: string; description: string; status: string; created_at: string }[];
  onChanged: () => void;
  onSelect: (id: string) => void;
}) {
  const create = useServerFn(adminCreateElection);
  const activate = useServerFn(adminActivateElection);
  const end = useServerFn(adminEndElection);
  const del = useServerFn(adminDeleteElection);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [elType, setElType] = useState<ElectionType>("general");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const res = await create({ data: { title, description: desc, electionType: elType } });
      setTitle(""); setDesc(""); setElType("general");
      onChanged();
      onSelect(res.election.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function act(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="panel p-6">
        <div className="font-display text-xl font-bold">Create election</div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label block mb-1">Election type</label>
            <select className="field" value={elType} onChange={(e) => setElType(e.target.value as ElectionType)}>
              {ELECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Title</label>
            <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Annual Staff Leadership Election 2025" />
          </div>
          <div>
            <label className="label block mb-1">Description</label>
            <textarea className="field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder="e.g. Vote for executive and departmental leadership roles for the 2025 fiscal year…" />
          </div>
          <button className="btn-primary" disabled={busy}><Plus size={14} /> Create</button>
          {err && <div className="border border-danger p-2 text-sm text-danger">{err}</div>}
        </form>
      </div>
      <div className="panel p-6">
        <div className="font-display text-xl font-bold">All elections</div>
        <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
          {elections.length === 0 && <div className="text-fg-dim text-sm">No elections yet.</div>}
          {elections.map((e) => (
            <div key={e.id} className="border border-line-dim p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => onSelect(e.id)} className="font-medium truncate text-left hover:text-accent">{e.title}</button>
                  <div className="text-xs text-fg-dim flex items-center gap-2 mt-0.5">
                    <span className={`datum ${
                      e.status === "active" ? "text-accent" : e.status === "ended" ? "text-danger" : ""
                    }`}>{e.status}</span>
                    {(e as any).election_type && (
                      <span className="label text-xs px-1.5 py-0.5 border border-line-dim">
                        {ELECTION_TYPES.find((t) => t.value === (e as any).election_type)?.label ?? (e as any).election_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {e.status === "draft" && (
                    <button className="btn" onClick={() => act(() => activate({ data: { electionId: e.id } }))} title="Activate">
                      <Play size={14} />
                    </button>
                  )}
                  {e.status === "active" && (
                    <button className="btn-danger" onClick={() => act(() => end({ data: { electionId: e.id } }))} title="End">
                      <Square size={14} />
                    </button>
                  )}
                  {e.status !== "active" && (
                    <button className="btn-danger" onClick={() => {
                      if (confirm(`Delete "${e.title}"? This removes candidates, tickets, and votes.`)) {
                        act(() => del({ data: { electionId: e.id } }));
                      }
                    }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BallotTab({ electionId, onChanged }: { electionId: string; onChanged: () => void }) {
  const getFn = useServerFn(adminGetElection);
  const addPos = useServerFn(adminAddPosition);
  const rmPos = useServerFn(adminRemovePosition);
  const addCand = useServerFn(adminAddCandidate);
  const rmCand = useServerFn(adminRemoveCandidate);
  const q = useQuery({ queryKey: ["admin-election-detail", electionId], queryFn: () => getFn({ data: { electionId } }) });

  const [posName, setPosName] = useState("");
  const [posDesc, setPosDesc] = useState("");
  const [candName, setCandName] = useState<Record<string, string>>({});
  const [candBio, setCandBio] = useState<Record<string, string>>({});
  const [candPhoto, setCandPhoto] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); await q.refetch(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  const election = q.data?.election;
  const positions = q.data?.positions ?? [];
  const candidates = q.data?.candidates ?? [];
  const elType = (election as any)?.election_type as string | undefined;
  const elTypeLabel = ELECTION_TYPES.find((t) => t.value === elType)?.label ?? elType ?? "General Election";
  const isLocked = election?.status === "ended";

  return (
    <div className="space-y-6">
      {/* Election context banner */}
      {election && (
        <div className={`panel p-5 border-l-4 ${
          election.status === "active" ? "border-l-accent" :
          election.status === "ended" ? "border-l-danger" : "border-l-line"
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="label text-xs px-2 py-0.5 border border-accent text-accent">{elTypeLabel}</span>
                <span className={`label text-xs px-2 py-0.5 border ${
                  election.status === "active" ? "border-accent text-accent" :
                  election.status === "ended" ? "border-danger text-danger" : "border-line text-fg-dim"
                }`}>{election.status.toUpperCase()}</span>
              </div>
              <div className="font-display text-xl font-black">{election.title}</div>
              {election.description && <div className="text-sm text-fg-dim mt-1">{election.description}</div>}
            </div>
            <div className="text-right">
              <div className="label text-xs">Positions</div>
              <div className="font-display text-2xl font-black">{positions.length}</div>
            </div>
          </div>
          {isLocked && (
            <div className="mt-3 border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
              This election has ended. The ballot is locked — no changes can be made.
            </div>
          )}
        </div>
      )}

      {err && <div className="border border-danger p-3 text-sm text-danger">{err}</div>}

      {/* Add position — disabled if ended */}
      {!isLocked && (
        <div className="panel p-6">
          <div className="font-display text-xl font-bold">Add position</div>
          <div className="text-xs text-fg-dim mt-0.5 mb-3">Positions are the roles being contested in this {elTypeLabel}.</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <input className="field" placeholder="e.g. Chief Executive Officer, Head of HR…" value={posName} onChange={(e) => setPosName(e.target.value)} />
            <input className="field" placeholder="e.g. Oversees company-wide operations (optional)" value={posDesc} onChange={(e) => setPosDesc(e.target.value)} />
            <button className="btn-primary" onClick={() => {
              if (!posName.trim()) return;
              act(async () => { await addPos({ data: { electionId, name: posName, description: posDesc } }); setPosName(""); setPosDesc(""); });
            }}><Plus size={14} /> Add</button>
          </div>
        </div>
      )}

      {positions.length === 0 && <div className="panel p-6 text-fg-dim">No positions yet. Add a position above to start building the ballot.</div>}

      {positions.map((pos) => {
        const list = candidates.filter((c) => c.position_id === pos.id);
        return (
          <div key={pos.id} className="panel overflow-hidden">
            {/* Position header */}
            <div className="px-6 py-4 bg-bg-2 border-b border-line flex items-center justify-between">
              <div>
                <div className="label text-xs mb-0.5">{elTypeLabel} · Position</div>
                <div className="font-display text-xl font-bold">{pos.name}</div>
                {pos.description && <div className="text-sm text-fg-dim">{pos.description}</div>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="label text-xs">Candidates</div>
                  <div className="font-display text-xl font-black">{list.length}</div>
                </div>
                {!isLocked && (
                  <button className="btn-danger" onClick={() => {
                    if (confirm(`Remove position "${pos.name}" and all its candidates?`)) {
                      act(() => rmPos({ data: { positionId: pos.id } }));
                    }
                  }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>

            {/* Candidate list */}
            <div className="p-5 grid gap-2">
              {list.length === 0 && (
                <div className="text-sm text-fg-dim py-2">No candidates yet. Add at least 2 to activate the election.</div>
              )}
              {list.map((c) => (
                <div key={c.id} className="border border-line-dim p-3 flex items-center gap-3">
                  <img src={c.photo_url} alt="" className="w-10 h-10 border border-line object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.bio && <div className="text-xs text-fg-dim truncate">{c.bio}</div>}
                  </div>
                  {!isLocked && (
                    <button className="btn-danger" onClick={() => {
                      if (confirm(`Remove candidate "${c.name}"?`)) act(() => rmCand({ data: { candidateId: c.id } }));
                    }}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>

            {/* Add candidate form */}
            {!isLocked && (
              <div className="px-5 pb-5 border-t border-line-dim pt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input className="field" placeholder="e.g. John Mensah"
                  value={candName[pos.id] ?? ""} onChange={(e) => setCandName((s) => ({ ...s, [pos.id]: e.target.value }))} />
                <input className="field" placeholder="e.g. Senior Manager, 10 yrs experience (optional)"
                  value={candBio[pos.id] ?? ""} onChange={(e) => setCandBio((s) => ({ ...s, [pos.id]: e.target.value }))} />
                <input className="field" placeholder="Profile photo URL (optional)"
                  value={candPhoto[pos.id] ?? ""} onChange={(e) => setCandPhoto((s) => ({ ...s, [pos.id]: e.target.value }))} />
                <button className="btn-primary" onClick={() => {
                  const name = (candName[pos.id] ?? "").trim(); if (!name) return;
                  act(async () => {
                    await addCand({ data: {
                      positionId: pos.id, name,
                      bio: candBio[pos.id] ?? "",
                      photoUrl: (candPhoto[pos.id] ?? "").trim() || undefined,
                    }});
                    setCandName((s) => ({ ...s, [pos.id]: "" }));
                    setCandBio((s) => ({ ...s, [pos.id]: "" }));
                    setCandPhoto((s) => ({ ...s, [pos.id]: "" }));
                  });
                }}><Plus size={14} /> Add candidate</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TicketsTab({ electionId, onChanged }: { electionId: string; onChanged: () => void }) {
  const listFn = useServerFn(adminListUsers);
  const issueFn = useServerFn(adminIssueTickets);
  const issueAllFn = useServerFn(adminIssueAllTickets);
  const revokeFn = useServerFn(adminRevokeTicket);
  const promoteFn = useServerFn(adminPromoteUser);
  const demoteFn = useServerFn(adminDemoteUser);
  const q = useQuery({
    queryKey: ["admin-users", electionId],
    queryFn: () => listFn({ data: { electionId } }),
    refetchInterval: 10_000,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "used" | "terminated">("all");

  const users = q.data?.users ?? [];

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ? true :
      filter === "pending" ? !u.ticket :
      u.ticket?.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: users.length,
    pending: users.filter((u) => !u.ticket).length,
    active: users.filter((u) => u.ticket?.status === "active").length,
    used: users.filter((u) => u.ticket?.status === "used").length,
    terminated: users.filter((u) => u.ticket?.status === "terminated").length,
  };

  async function issueAll() {
    setBusy(true); setErr(null);
    try { const r = await issueAllFn({ data: { electionId } }); alert(`Issued ${r.issued} new ticket(s).`); await q.refetch(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function issueOne(userId: string) {
    setErr(null);
    try { await issueFn({ data: { electionId, userIds: [userId] } }); await q.refetch(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function revoke(ticketId: string) {
    if (!confirm("Terminate this ticket? The user can no longer vote with it.")) return;
    setErr(null);
    try { await revokeFn({ data: { ticketId } }); await q.refetch(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function promote(userId: string, name: string) {
    if (!confirm(`Promote "${name}" to admin?`)) return;
    setErr(null);
    try { await promoteFn({ data: { userId } }); await q.refetch(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function demote(userId: string, name: string) {
    if (!confirm(`Remove admin role from "${name}"?`)) return;
    setErr(null);
    try { await demoteFn({ data: { userId } }); await q.refetch(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="space-y-4">
      {/* Header stats + issue all */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <div><div className="label text-xs">Total users</div><div className="font-display text-2xl font-black">{users.length}</div></div>
          <div><div className="label text-xs">Tickets issued</div><div className="font-display text-2xl font-black text-accent">{counts.active + counts.used + counts.terminated}</div></div>
          <div><div className="label text-xs">Voted</div><div className="font-display text-2xl font-black text-ok">{counts.used}</div></div>
          <div><div className="label text-xs">Pending</div><div className="font-display text-2xl font-black text-warn">{counts.pending}</div></div>
        </div>
        <button className="btn-primary" onClick={issueAll} disabled={busy || counts.pending === 0}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          <Ticket size={14} /> Issue to all pending ({counts.pending})
        </button>
      </div>

      {err && <div className="border border-danger p-3 text-sm text-danger">{err}</div>}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim" />
          <input
            className="field pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "pending", "active", "used", "terminated"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 label text-xs border ${
                filter === f ? "border-accent text-accent bg-accent/5" : "border-line text-fg-dim hover:border-fg-dim"
              }`}
            >
              {f} <span className="ml-1 opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="panel hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-3 label">Name</th>
              <th className="p-3 label">Email</th>
              <th className="p-3 label">Roles</th>
              <th className="p-3 label">Ticket</th>
              <th className="p-3 label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-fg-dim">No users match your search.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-line-dim hover:bg-bg-2 transition-colors">
                <td className="p-3 font-medium">{u.full_name || "—"}</td>
                <td className="p-3 text-fg-dim text-xs">{u.email}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {u.roles.map((r) => (
                      <span key={r} className={`label text-xs px-1.5 py-0.5 border ${
                        r === "admin" ? "border-accent text-accent" : "border-line-dim text-fg-dim"
                      }`}>{r}</span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  {u.ticket ? (
                    <span className="datum text-xs">
                      <span className="text-accent font-bold tracking-widest">{u.ticket.code}</span>
                      <span className={`ml-2 ${
                        u.ticket.status === "active" ? "text-ok" :
                        u.ticket.status === "used" ? "text-fg-dim" : "text-danger"
                      }`}>{u.ticket.status}</span>
                    </span>
                  ) : <span className="text-fg-mute text-xs">No ticket</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {!u.ticket && (
                      <button className="btn" onClick={() => issueOne(u.id)}><UserPlus size={13} /> Issue</button>
                    )}
                    {u.ticket?.status === "active" && (
                      <button className="btn-danger" onClick={() => revoke(u.ticket!.id)}><ShieldOff size={13} /> Revoke</button>
                    )}
                    {!u.roles.includes("admin") ? (
                      <button className="btn" onClick={() => promote(u.id, u.full_name || u.email || "")} title="Make admin">
                        <ShieldCheck size={13} /> Admin
                      </button>
                    ) : (
                      <button className="btn-danger" onClick={() => demote(u.id, u.full_name || u.email || "")} title="Remove admin">
                        <ShieldX size={13} /> Demote
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="panel p-6 text-center text-fg-dim">No users match your search.</div>
        )}
        {filtered.map((u) => (
          <div key={u.id} className="panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{u.full_name || "—"}</div>
                <div className="text-xs text-fg-dim mt-0.5">{u.email}</div>
              </div>
              <div className="flex gap-1">
                {u.roles.map((r) => (
                  <span key={r} className={`label text-xs px-1.5 py-0.5 border ${
                    r === "admin" ? "border-accent text-accent" : "border-line-dim text-fg-dim"
                  }`}>{r}</span>
                ))}
              </div>
            </div>
            <div className="border-t border-line-dim pt-3">
              {u.ticket ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="label text-xs mb-0.5">Ticket</div>
                    <div className="font-mono font-bold text-accent tracking-widest text-sm">{u.ticket.code}</div>
                  </div>
                  <span className={`label text-xs px-2 py-1 border ${
                    u.ticket.status === "active" ? "border-ok text-ok" :
                    u.ticket.status === "used" ? "border-line text-fg-dim" : "border-danger text-danger"
                  }`}>{u.ticket.status}</span>
                </div>
              ) : (
                <div className="text-xs text-fg-mute">No ticket issued</div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!u.ticket && (
                <button className="btn flex-1" onClick={() => issueOne(u.id)}><UserPlus size={13} /> Issue ticket</button>
              )}
              {u.ticket?.status === "active" && (
                <button className="btn-danger flex-1" onClick={() => revoke(u.ticket!.id)}><ShieldOff size={13} /> Revoke</button>
              )}
              {!u.roles.includes("admin") ? (
                <button className="btn" onClick={() => promote(u.id, u.full_name || u.email || "")}>
                  <ShieldCheck size={13} /> Make admin
                </button>
              ) : (
                <button className="btn-danger" onClick={() => demote(u.id, u.full_name || u.email || "")}>
                  <ShieldX size={13} /> Remove admin
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab({ electionId }: { electionId: string }) {
  const getFn = useServerFn(adminGetElection);
  const q = useQuery({
    queryKey: ["admin-election-detail", electionId],
    queryFn: () => getFn({ data: { electionId } }),
    refetchInterval: 5_000,
  });
  const positions = q.data?.positions ?? [];
  const candidates = q.data?.candidates ?? [];
  const results = q.data?.results ?? [];
  const stats = q.data?.stats;
  const election = q.data?.election;

  const chartByPos = useMemo(() => {
    return positions.map((p) => ({
      position: p,
      data: candidates
        .filter((c) => c.position_id === p.id)
        .map((c) => ({
          name: c.name,
          photo: c.photo_url,
          votes: results.find((r) => r.candidate_id === c.id)?.votes ?? 0,
        }))
        .sort((a, b) => b.votes - a.votes),
    }));
  }, [positions, candidates, results]);

  if (q.isLoading) return <div className="panel p-10 flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={32} /></div>;
  if (!stats) return <div className="panel p-6 text-fg-dim">No data yet.</div>;

  const turnout = stats.ticketsIssued > 0 ? (stats.ticketsUsed / stats.ticketsIssued) * 100 : 0;
  const turnoutData = [{ name: "Voted", value: turnout }, { name: "Remaining", value: 100 - turnout }];
  const COLORS = ["#B4FF39", "#26262E"];

  const ticketBreakdown = [
    { name: "Used", value: stats.ticketsUsed, fill: "#B4FF39" },
    { name: "Active", value: stats.ticketsActive, fill: "#3AF0FF" },
    { name: "Terminated", value: stats.ticketsTerminated ?? 0, fill: "#FF3B5C" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Election title banner */}
      <div className="panel p-5 border-accent flex items-center justify-between gap-4">
        <div>
          <div className="label text-xs mb-1">Live Analytics</div>
          <h2 className="font-display text-2xl font-black">{election?.title}</h2>
        </div>
        <div className={`label text-xs px-3 py-1.5 border ${
          election?.status === "active" ? "border-accent text-accent" :
          election?.status === "ended" ? "border-danger text-danger" : "border-line text-fg-dim"
        }`}>{election?.status?.toUpperCase()}</div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox icon={<Ticket size={18} />} label="Tickets Issued" value={stats.ticketsIssued} />
        <StatBox icon={<CheckCircle2 size={18} />} label="Votes Cast" value={stats.ticketsUsed} accent />
        <StatBox icon={<Users size={18} />} label="Still Active" value={stats.ticketsActive} cyan />
        <StatBox icon={<TrendingUp size={18} />} label="Turnout" value={`${turnout.toFixed(1)}%`} accent={turnout >= 50} warn={turnout > 0 && turnout < 50} />
      </div>

      {/* Turnout + Ticket breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Turnout donut */}
        <div className="panel p-6">
          <div className="label text-xs mb-1">Voter Turnout</div>
          <div className="font-display text-xl font-bold mb-4">How many voted?</div>
          <div className="flex items-center gap-6">
            <div className="relative w-36 h-36 flex-shrink-0">
              <PieChart width={144} height={144}>
                <Pie data={turnoutData} cx={67} cy={67} innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {turnoutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-black text-accent">{turnout.toFixed(0)}%</span>
                <span className="label text-xs">voted</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-dim">Voted</span>
                <span className="datum font-bold text-accent">{stats.ticketsUsed}</span>
              </div>
              <div className="w-full bg-line h-2">
                <div className="h-2 bg-accent transition-all" style={{ width: `${turnout}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-dim">Pending</span>
                <span className="datum font-bold text-fg-dim">{stats.ticketsActive}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket status pie */}
        <div className="panel p-6">
          <div className="label text-xs mb-1">Ticket Status</div>
          <div className="font-display text-xl font-bold mb-4">Breakdown</div>
          {ticketBreakdown.length === 0 ? (
            <div className="text-fg-dim text-sm py-8 text-center">No tickets issued yet.</div>
          ) : (
            <div className="flex items-center gap-6">
              <PieChart width={144} height={144}>
                <Pie data={ticketBreakdown} cx={67} cy={67} outerRadius={68} dataKey="value" strokeWidth={2} stroke="#08080B">
                  {ticketBreakdown.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#14141B", border: "1px solid #26262E", color: "#EDEDEF", fontFamily: "JetBrains Mono", fontSize: "0.8rem" }} />
              </PieChart>
              <div className="space-y-2 flex-1">
                {ticketBreakdown.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-sm text-fg-dim flex-1">{d.name}</span>
                    <span className="datum font-bold" style={{ color: d.fill }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-position results */}
      {chartByPos.length === 0 && (
        <div className="panel p-8 text-center text-fg-dim">No positions configured yet.</div>
      )}
      {chartByPos.map(({ position, data }) => {
        const totalPosVotes = data.reduce((s, d) => s + d.votes, 0);
        const winner = data[0];
        return (
          <div key={position.id} className="panel overflow-hidden">
            {/* Position header */}
            <div className="px-6 py-4 bg-bg-2 border-b border-line flex items-center justify-between gap-4">
              <div>
                <div className="label text-xs mb-0.5">Position</div>
                <div className="font-display text-xl font-black">{position.name}</div>
                {position.description && <div className="text-xs text-fg-dim mt-0.5">{position.description}</div>}
              </div>
              <div className="text-right">
                <div className="label text-xs">Total votes</div>
                <div className="font-display text-2xl font-black text-accent">{totalPosVotes}</div>
              </div>
            </div>

            <div className="p-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Bar chart */}
              <div>
                <div className="label text-xs mb-3">Vote distribution</div>
                {data.length === 0 ? (
                  <div className="text-fg-dim text-sm">No candidates.</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                        <CartesianGrid stroke="#26262E" horizontal={false} />
                        <XAxis type="number" stroke="#5E5E67" allowDecimals={false} tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" stroke="#9A9AA3" width={130} tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#14141B", border: "1px solid #26262E", color: "#EDEDEF", fontFamily: "JetBrains Mono", fontSize: "0.8rem" }}
                          formatter={(v) => [v ?? 0, "votes"]}
                        />
                        <Bar dataKey="votes" radius={0}>
                          {data.map((entry, i) => (
                            <Cell key={i} fill={i === 0 && entry.votes > 0 ? "#B4FF39" : "#3AF0FF"} />
                          ))}
                          <LabelList dataKey="votes" position="right" fill="#EDEDEF" style={{ fontFamily: "JetBrains Mono", fontSize: 12 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Candidate cards with % bars */}
              <div className="space-y-3">
                <div className="label text-xs mb-3">Candidate standings</div>
                {data.map((c, i) => {
                  const pct = totalPosVotes > 0 ? (c.votes / totalPosVotes) * 100 : 0;
                  const isLeading = i === 0 && c.votes > 0;
                  return (
                    <div key={c.name} className={`border p-3 ${isLeading ? "border-accent bg-accent/5" : "border-line-dim"}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <img src={c.photo} alt="" className="w-9 h-9 border border-line object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isLeading && <Trophy size={12} className="text-accent flex-shrink-0" />}
                            <span className="font-semibold text-sm truncate">{c.name}</span>
                          </div>
                          <div className="datum text-xs text-fg-dim">{c.votes} vote{c.votes !== 1 ? "s" : ""} · {pct.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="w-full bg-line h-1.5">
                        <div
                          className="h-1.5 transition-all duration-700"
                          style={{ width: `${pct}%`, background: isLeading ? "#B4FF39" : "#3AF0FF" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Winner banner */}
            {winner && winner.votes > 0 && (
              <div className="px-6 py-3 bg-accent/10 border-t border-accent flex items-center gap-3">
                <Trophy size={16} className="text-accent flex-shrink-0" />
                <span className="label text-xs text-accent">Current leader:</span>
                <span className="font-display font-bold text-accent">{winner.name}</span>
                <span className="ml-auto datum text-xs text-accent">{winner.votes} votes</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VotersTab({ electionId }: { electionId: string }) {
  const uploadFn = useServerFn(adminUploadVoters);
  const listFn   = useServerFn(adminListEligibleVoters);
  const editFn   = useServerFn(adminEditEligibleVoter);
  const removeFn = useServerFn(adminRemoveEligibleVoter);

  const [search, setSearch]         = useState("");
  const [err, setErr]               = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    accepted: number; rejected: number; rejectedRows: { row: number; raw_name: string; raw_phone: string; reason: string }[];
  } | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editPhone, setEditPhone]   = useState("");
  const [busy, setBusy]             = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["eligible-voters", electionId, search],
    queryFn: () => listFn({ data: { electionId, search } }),
    refetchInterval: 15_000,
  });
  const voters = q.data?.voters ?? [];

  // Build the voter login link for this election
  const voteLink = typeof window !== "undefined"
    ? `${window.location.origin}/vote-public?election=${electionId}`
    : `/vote-public?election=${electionId}`;

  const [linkCopied, setLinkCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(voteLink);
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadResult(null); setBusy(true);
    try {
      const csvText = await file.text();
      const res = await uploadFn({ data: { electionId, csvText } });
      setUploadResult(res);
      q.refetch();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleEdit(voterId: string) {
    setErr(null); setBusy(true);
    try {
      await editFn({ data: { voterId, fullName: editName || undefined, phoneNumber: editPhone || undefined } });
      setEditingId(null); q.refetch();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function handleRemove(voterId: string, name: string) {
    if (!confirm(`Remove "${name}" from the voter list?`)) return;
    setErr(null);
    try { await removeFn({ data: { voterId } }); q.refetch(); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
  }

  const voted   = voters.filter((v) => v.has_voted).length;
  const pending = voters.length - voted;

  return (
    <div className="space-y-5">

      {/* Voter link */}
      <div className="panel p-5">
        <div className="label text-xs mb-2">Voter login link — share this with eligible voters</div>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 field font-mono text-xs truncate flex items-center">{voteLink}</div>
          <button className="btn px-4" onClick={copyLink}>
            {linkCopied ? <CheckCircle2 size={14} className="text-ok" /> : <Link2 size={14} />}
            {linkCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Upload */}
      <div className="panel p-6">
        <div className="font-display text-xl font-bold mb-1">Upload voter list</div>
        <p className="text-sm text-fg-dim mb-4">
          CSV file with columns: <span className="font-mono text-accent">full_name</span>, <span className="font-mono text-accent">phone_number</span>. Header row required. Duplicate phone numbers are skipped.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? "Uploading…" : "Choose CSV file"}
          </button>
        </div>

        {err && <div className="mt-3 border border-danger p-3 text-sm text-danger">{err}</div>}

        {uploadResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-ok/40 bg-ok/5 p-3">
                <div className="label text-xs text-ok">Accepted</div>
                <div className="font-display text-2xl font-black text-ok">{uploadResult.accepted}</div>
              </div>
              <div className="border border-danger/40 bg-danger/5 p-3">
                <div className="label text-xs text-danger">Rejected</div>
                <div className="font-display text-2xl font-black text-danger">{uploadResult.rejected}</div>
              </div>
            </div>
            {uploadResult.rejectedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="label text-xs text-danger">{uploadResult.rejectedRows.length} rejected row{uploadResult.rejectedRows.length !== 1 ? "s" : ""}</span>
                  <button
                    className="btn"
                    onClick={() => {
                      const csv = ["row,full_name,phone_number,reason",
                        ...uploadResult.rejectedRows.map((r) =>
                          `${r.row},"${r.raw_name.replace(/"/g, '""')}","${r.raw_phone.replace(/"/g, '""')}","${r.reason}"`
                        )
                      ].join("\n");
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                      a.download = "rejected_voters.csv";
                      a.click();
                    }}
                  >
                    <Upload size={13} className="rotate-180" /> Download rejected rows
                  </button>
                </div>
                <div className="border border-line overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-bg-2">
                      <th className="p-2 label text-left">Row</th>
                      <th className="p-2 label text-left">Name</th>
                      <th className="p-2 label text-left">Phone</th>
                      <th className="p-2 label text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.rejectedRows.map((r) => (
                      <tr key={r.row} className="border-b border-line-dim">
                        <td className="p-2 text-fg-mute">{r.row}</td>
                        <td className="p-2">{r.raw_name || "—"}</td>
                        <td className="p-2 font-mono">{r.raw_phone || "—"}</td>
                        <td className="p-2 text-danger">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats + search */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-5">
          <div><div className="label text-xs">Total voters</div><div className="font-display text-2xl font-black">{voters.length}</div></div>
          <div><div className="label text-xs">Voted</div><div className="font-display text-2xl font-black text-accent">{voted}</div></div>
          <div><div className="label text-xs">Pending</div><div className="font-display text-2xl font-black text-warn">{pending}</div></div>
        </div>
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim" />
          <input
            className="field pl-9"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Voter table */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-3 label">Name</th>
              <th className="p-3 label">Phone</th>
              <th className="p-3 label">Status</th>
              <th className="p-3 label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {voters.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-fg-dim">No voters uploaded yet.</td></tr>
            )}
            {voters.map((v) => (
              <tr key={v.id} className="border-b border-line-dim hover:bg-bg-2 transition-colors">
                <td className="p-3">
                  {editingId === v.id ? (
                    <input
                      className="field text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={v.full_name}
                    />
                  ) : (
                    <span className="font-medium">{v.full_name}</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs">
                  {editingId === v.id ? (
                    <input
                      className="field text-sm font-mono"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder={v.phone_number}
                    />
                  ) : (
                    v.phone_number
                  )}
                </td>
                <td className="p-3">
                  {v.has_voted ? (
                    <span className="label text-xs px-2 py-0.5 border border-ok text-ok">Voted</span>
                  ) : (
                    <span className="label text-xs px-2 py-0.5 border border-warn text-warn">Pending</span>
                  )}
                </td>
                <td className="p-3">
                  {editingId === v.id ? (
                    <div className="flex gap-1">
                      <button className="btn" onClick={() => handleEdit(v.id)} disabled={busy}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Save
                      </button>
                      <button className="btn" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {!v.has_voted && (
                        <button
                          className="btn"
                          onClick={() => { setEditingId(v.id); setEditName(v.full_name); setEditPhone(v.phone_number); }}
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {!v.has_voted && (
                        <button className="btn-danger" onClick={() => handleRemove(v.id, v.full_name)} title="Remove">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTab() {
  const getFn = useServerFn(adminGetElectionHistory);
  const q = useQuery({
    queryKey: ["election-history"],
    queryFn: () => getFn(),
    refetchInterval: 15_000,
  });
  const history = q.data?.history ?? [];

  if (q.isLoading) return <div className="panel p-10 flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="panel p-4 flex items-center gap-3">
        <History size={16} className="text-accent" />
        <div className="label text-xs">All elections — {history.length} total</div>
      </div>

      {history.length === 0 && (
        <div className="panel p-8 text-center text-fg-dim">No elections recorded yet.</div>
      )}

      {history.map((e) => {
        const turnout = Number(e.turnout_pct ?? 0);
        return (
          <div key={e.id} className="panel overflow-hidden">
            <div className="px-5 py-4 bg-bg-2 border-b border-line flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-lg font-bold">{e.title}</div>
                {e.description && <div className="text-xs text-fg-dim mt-0.5 max-w-xl">{e.description}</div>}
                {(e.location || e.region) && (
                  <div className="text-xs text-fg-mute mt-1">{[e.location, e.region].filter(Boolean).join(" · ")}</div>
                )}
              </div>
              <div className={`label text-xs px-2 py-1 border flex-shrink-0 ${
                e.status === "active" ? "border-accent text-accent" :
                e.status === "ended"  ? "border-danger text-danger" : "border-line text-fg-dim"
              }`}>{e.status?.toUpperCase()}</div>
            </div>

            <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="label text-xs mb-1">Tickets issued</div>
                <div className="font-display text-2xl font-black">{e.tickets_issued ?? 0}</div>
              </div>
              <div>
                <div className="label text-xs mb-1">Votes cast</div>
                <div className="font-display text-2xl font-black text-accent">{e.tickets_used ?? 0}</div>
              </div>
              <div>
                <div className="label text-xs mb-1">Turnout</div>
                <div className="font-display text-2xl font-black" style={{ color: turnout >= 50 ? "#B4FF39" : turnout > 0 ? "#FFB020" : undefined }}>
                  {turnout.toFixed(1)}%
                </div>
                <div className="mt-1 w-full bg-line h-1.5">
                  <div className="h-1.5 transition-all" style={{ width: `${Math.min(turnout, 100)}%`, background: turnout >= 50 ? "#B4FF39" : "#FFB020" }} />
                </div>
              </div>
              <div>
                <div className="label text-xs mb-1">Terminated</div>
                <div className="font-display text-2xl font-black text-fg-dim">{e.tickets_terminated ?? 0}</div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-line-dim flex flex-wrap gap-4 text-xs text-fg-mute">
              {e.created_at && (
                <span className="flex items-center gap-1.5">
                  <Clock size={11} /> Created {new Date(e.created_at).toLocaleDateString()}
                </span>
              )}
              {e.activated_at && (
                <span className="flex items-center gap-1.5">
                  <Play size={11} className="text-accent" /> Activated {new Date(e.activated_at).toLocaleDateString()}
                </span>
              )}
              {e.ended_at && (
                <span className="flex items-center gap-1.5">
                  <Square size={11} className="text-danger" /> Ended {new Date(e.ended_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatBox({
  label, value, accent = false, cyan = false, warn = false, icon,
}: {
  label: string; value: string | number; accent?: boolean; cyan?: boolean; warn?: boolean; icon?: React.ReactNode;
}) {
  const color = accent ? "text-accent" : cyan ? "text-accent-2" : warn ? "text-warn" : "";
  const border = accent ? "border-accent" : cyan ? "border-accent-2" : warn ? "border-warn" : "";
  return (
    <div className={`panel p-5 ${border}`}>
      <div className={`flex items-center gap-2 label text-xs mb-2 ${color || "text-fg-dim"}`}>
        {icon}
        {label}
      </div>
      <div className={`font-display text-4xl font-black leading-none ${color}`}>{value}</div>
    </div>
  );
}
