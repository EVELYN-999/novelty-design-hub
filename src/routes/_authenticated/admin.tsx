import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import {
  getMe, adminListElections, adminCreateElection, adminActivateElection,
  adminEndElection, adminDeleteElection, adminGetElection, adminAddPosition,
  adminRemovePosition, adminAddCandidate, adminRemoveCandidate, adminListUsers,
  adminIssueTickets, adminIssueAllTickets, adminRevokeTicket,
} from "@/lib/election.functions";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Loader2, Plus, Trash2, Play, Square, Ticket, UserPlus, ShieldOff, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "elections" | "ballot" | "tickets" | "analytics";

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
          {(["elections", "ballot", "tickets", "analytics"] as Tab[]).map((t) => (
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
          {selectedEl && tab === "tickets" && (
            <TicketsTab electionId={selectedEl} onChanged={invalidateAll} />
          )}
          {selectedEl && tab === "analytics" && (
            <AnalyticsTab electionId={selectedEl} />
          )}
          {!selectedEl && tab !== "elections" && (
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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const res = await create({ data: { title, description: desc } });
      setTitle(""); setDesc("");
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
            <label className="label block mb-1">Title</label>
            <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label block mb-1">Description</label>
            <textarea className="field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
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
                  <div className="text-xs text-fg-dim">
                    <span className={`datum ${e.status === "active" ? "text-accent" : e.status === "ended" ? "text-danger" : ""}`}>
                      {e.status}
                    </span>
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

  const positions = q.data?.positions ?? [];
  const candidates = q.data?.candidates ?? [];

  return (
    <div className="space-y-6">
      {err && <div className="border border-danger p-3 text-sm text-danger">{err}</div>}

      <div className="panel p-6">
        <div className="font-display text-xl font-bold">Add position</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input className="field" placeholder="Name (e.g. President)" value={posName} onChange={(e) => setPosName(e.target.value)} />
          <input className="field" placeholder="Description (optional)" value={posDesc} onChange={(e) => setPosDesc(e.target.value)} />
          <button className="btn-primary" onClick={() => {
            if (!posName.trim()) return;
            act(async () => { await addPos({ data: { electionId, name: posName, description: posDesc } }); setPosName(""); setPosDesc(""); });
          }}><Plus size={14} /> Add</button>
        </div>
      </div>

      {positions.length === 0 && <div className="panel p-6 text-fg-dim">No positions yet.</div>}

      {positions.map((pos) => {
        const list = candidates.filter((c) => c.position_id === pos.id);
        return (
          <div key={pos.id} className="panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-xl font-bold">{pos.name}</div>
                {pos.description && <div className="text-sm text-fg-dim">{pos.description}</div>}
              </div>
              <button className="btn-danger" onClick={() => {
                if (confirm(`Remove position "${pos.name}" and its candidates?`)) {
                  act(() => rmPos({ data: { positionId: pos.id } }));
                }
              }}><Trash2 size={14} /></button>
            </div>

            <div className="mt-4 grid gap-2">
              {list.map((c) => (
                <div key={c.id} className="border border-line-dim p-3 flex items-center gap-3">
                  <img src={c.photo_url} alt="" className="w-10 h-10 border border-line object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.bio && <div className="text-xs text-fg-dim truncate">{c.bio}</div>}
                  </div>
                  <button className="btn-danger" onClick={() => {
                    if (confirm(`Remove candidate "${c.name}"?`)) act(() => rmCand({ data: { candidateId: c.id } }));
                  }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-line-dim pt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className="field" placeholder="Candidate name"
                value={candName[pos.id] ?? ""} onChange={(e) => setCandName((s) => ({ ...s, [pos.id]: e.target.value }))} />
              <input className="field" placeholder="Bio (optional)"
                value={candBio[pos.id] ?? ""} onChange={(e) => setCandBio((s) => ({ ...s, [pos.id]: e.target.value }))} />
              <input className="field" placeholder="Photo URL (optional)"
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
              }}><Plus size={14} /></button>
            </div>
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
  const q = useQuery({
    queryKey: ["admin-users", electionId],
    queryFn: () => listFn({ data: { electionId } }),
    refetchInterval: 10_000,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const users = q.data?.users ?? [];

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

  return (
    <div className="space-y-4">
      <div className="panel p-4 flex items-center justify-between">
        <div>
          <div className="label">Registered users: {users.length}</div>
          <div className="label">Tickets issued: {users.filter((u) => u.ticket).length}</div>
        </div>
        <button className="btn-primary" onClick={issueAll} disabled={busy || users.length === 0}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          <Ticket size={14} /> Issue to all pending
        </button>
      </div>
      {err && <div className="border border-danger p-3 text-sm text-danger">{err}</div>}
      <div className="panel p-2">
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
            {users.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-fg-dim">No users have signed up yet.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line-dim">
                <td className="p-3">{u.full_name || "—"}</td>
                <td className="p-3 text-fg-dim">{u.email}</td>
                <td className="p-3 datum text-xs">{u.roles.join(", ")}</td>
                <td className="p-3">
                  {u.ticket ? (
                    <span className="datum">
                      <span className="text-accent font-bold">{u.ticket.code}</span>
                      <span className={`ml-2 text-xs ${u.ticket.status === "active" ? "text-ok" : u.ticket.status === "used" ? "text-fg-dim" : "text-danger"}`}>
                        {u.ticket.status}
                      </span>
                    </span>
                  ) : <span className="text-fg-dim">—</span>}
                </td>
                <td className="p-3">
                  {!u.ticket ? (
                    <button className="btn" onClick={() => issueOne(u.id)}><UserPlus size={14} /> Issue</button>
                  ) : u.ticket.status === "active" ? (
                    <button className="btn-danger" onClick={() => revoke(u.ticket!.id)}>
                      <ShieldOff size={14} /> Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  const chartByPos = useMemo(() => {
    return positions.map((p) => ({
      position: p,
      data: candidates.filter((c) => c.position_id === p.id).map((c) => ({
        name: c.name,
        votes: results.find((r) => r.candidate_id === c.id)?.votes ?? 0,
      })).sort((a, b) => b.votes - a.votes),
    }));
  }, [positions, candidates, results]);

  if (!stats) return <div className="panel p-6"><Loader2 className="animate-spin" /></div>;

  const turnout = stats.ticketsIssued > 0 ? (stats.ticketsUsed / stats.ticketsIssued) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatBox label="Issued" value={stats.ticketsIssued} />
        <StatBox label="Used" value={stats.ticketsUsed} accent />
        <StatBox label="Active" value={stats.ticketsActive} />
        <StatBox label="Turnout" value={`${turnout.toFixed(1)}%`} />
      </div>
      {chartByPos.map(({ position, data }) => (
        <div key={position.id} className="panel p-6">
          <div className="font-display text-xl font-bold">{position.name}</div>
          <div className="text-xs text-fg-dim">Votes per candidate</div>
          <div className="mt-4 h-72">
            {data.length === 0 ? (
              <div className="text-fg-dim text-sm">No candidates.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="#26262E" horizontal={false} />
                  <XAxis type="number" stroke="#9A9AA3" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9A9AA3" width={120} />
                  <Tooltip contentStyle={{ background: "#14141B", border: "1px solid #26262E", color: "#EDEDEF", fontFamily: "JetBrains Mono" }} />
                  <Bar dataKey="votes" fill="#B4FF39">
                    <LabelList dataKey="votes" position="right" fill="#EDEDEF" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`panel p-4 ${accent ? "border-accent" : ""}`}>
      <div className="label">{label}</div>
      <div className={`mt-1 font-display text-3xl font-black ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
