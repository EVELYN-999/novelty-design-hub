import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// --- public (anon) client for read-only public queries ---
function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if ((key.startsWith("sb_")) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function genCode(len = 8): string {
  const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = "";
  for (const b of arr) s += alpha[b % alpha.length];
  return s;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required.");
}

// ============ PROFILE ============

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ fullName: z.string().trim().max(120).default("") }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims.email as string | undefined) ?? "";
    await supabaseAdmin.from("profiles").upsert(
      { id: context.userId, full_name: data.fullName, email },
      { onConflict: "id" },
    );
    // Ensure voter role
    await supabaseAdmin.from("user_roles")
      .upsert({ user_id: context.userId, role: "voter" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const roles = (rolesRes.data ?? []).map((r) => r.role);
    return {
      profile: profRes.data,
      roles,
      isAdmin: roles.includes("admin"),
    };
  });

// First-user-becomes-admin bootstrap
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles")
      .select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An admin already exists. Contact the current admin.");
    const { error } = await supabaseAdmin.from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PUBLIC READS ============

export const getPublicElection = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data: active } = await sb.from("elections").select("*").eq("status", "active").order("activated_at", { ascending: false }).limit(1).maybeSingle();
  if (!active) {
    // Try most recent
    const { data: recent } = await sb.from("elections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { election: recent, positions: [], candidates: [], results: [] };
  }
  const [posRes, candRes, votesRes] = await Promise.all([
    sb.from("positions").select("*").eq("election_id", active.id).order("display_order"),
    sb.from("candidates").select("id, name, bio, photo_url, position_id"),
    sb.from("votes").select("candidate_id, position_id").eq("election_id", active.id),
  ]);
  const positions = posRes.data ?? [];
  const posIds = new Set(positions.map((p) => p.id));
  const candidates = (candRes.data ?? []).filter((c) => posIds.has(c.position_id));
  const tally = new Map<string, number>();
  for (const v of votesRes.data ?? []) {
    tally.set(v.candidate_id, (tally.get(v.candidate_id) ?? 0) + 1);
  }
  const results = candidates.map((c) => ({
    candidate_id: c.id, name: c.name, position_id: c.position_id, votes: tally.get(c.id) ?? 0,
  }));
  return { election: active, positions, candidates, results };
});

// ============ VOTER ============

export const getMyTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: active } = await supabaseAdmin.from("elections").select("*").eq("status", "active").order("activated_at", { ascending: false }).limit(1).maybeSingle();
    if (!active) return { election: null, ticket: null };
    const { data: ticket } = await supabaseAdmin.from("voting_tickets")
      .select("*").eq("election_id", active.id).eq("user_id", context.userId).maybeSingle();
    return { election: active, ticket };
  });

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    code: z.string().trim().min(4).max(32),
    selections: z.record(z.string().uuid(), z.string().uuid()),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    const { data: ticket, error: tErr } = await supabaseAdmin.from("voting_tickets")
      .select("*").eq("code", code).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Ticket code is invalid.");
    if (ticket.user_id !== context.userId) throw new Error("This ticket belongs to a different account.");
    if (ticket.status === "used") throw new Error("This ticket has already been used.");
    if (ticket.status === "terminated") throw new Error("This ticket has been terminated (the election is closed).");

    const { data: election } = await supabaseAdmin.from("elections").select("*").eq("id", ticket.election_id).maybeSingle();
    if (!election || election.status !== "active") throw new Error("Election is not currently active.");

    const [{ data: positions }, { data: candidates }] = await Promise.all([
      supabaseAdmin.from("positions").select("id").eq("election_id", election.id),
      supabaseAdmin.from("candidates").select("id, position_id"),
    ]);
    const posIds = new Set((positions ?? []).map((p) => p.id));
    const validPair = new Set((candidates ?? []).map((c) => `${c.position_id}:${c.id}`));

    for (const pid of posIds) {
      const cid = data.selections[pid];
      if (!cid) throw new Error("You must select a candidate for every position.");
      if (!validPair.has(`${pid}:${cid}`)) throw new Error("Invalid candidate for a position.");
    }
    for (const k of Object.keys(data.selections)) {
      if (!posIds.has(k)) throw new Error("Selection contains an unknown position.");
    }

    const rows = Object.entries(data.selections).map(([position_id, candidate_id]) => ({
      election_id: election.id, ticket_id: ticket.id, position_id, candidate_id,
    }));
    const { error: vErr } = await supabaseAdmin.from("votes").insert(rows);
    if (vErr) throw new Error(vErr.message);
    await supabaseAdmin.from("voting_tickets")
      .update({ status: "used", used_at: new Date().toISOString() }).eq("id", ticket.id);

    return { ok: true, count: rows.length };
  });

// ============ ADMIN ============

export const adminListElections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("elections").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { elections: data ?? [] };
  });

export const adminGetElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [elRes, posRes, candRes, ticketsRes, votesRes] = await Promise.all([
      supabaseAdmin.from("elections").select("*").eq("id", data.electionId).single(),
      supabaseAdmin.from("positions").select("*").eq("election_id", data.electionId).order("display_order"),
      supabaseAdmin.from("candidates").select("*"),
      supabaseAdmin.from("voting_tickets").select("*").eq("election_id", data.electionId),
      supabaseAdmin.from("votes").select("candidate_id, position_id").eq("election_id", data.electionId),
    ]);
    if (elRes.error) throw new Error(elRes.error.message);
    const positions = posRes.data ?? [];
    const posIds = new Set(positions.map((p) => p.id));
    const candidates = (candRes.data ?? []).filter((c) => posIds.has(c.position_id));
    const tally = new Map<string, number>();
    for (const v of votesRes.data ?? []) tally.set(v.candidate_id, (tally.get(v.candidate_id) ?? 0) + 1);
    const results = candidates.map((c) => ({
      candidate_id: c.id, name: c.name, position_id: c.position_id, votes: tally.get(c.id) ?? 0,
    }));
    const tickets = ticketsRes.data ?? [];
    return {
      election: elRes.data,
      positions, candidates, results,
      stats: {
        ticketsIssued: tickets.length,
        ticketsUsed: tickets.filter((t) => t.status === "used").length,
        ticketsActive: tickets.filter((t) => t.status === "active").length,
        ticketsTerminated: tickets.filter((t) => t.status === "terminated").length,
      },
    };
  });

export const adminCreateElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).default(""),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.from("elections")
      .insert({ title: data.title, description: data.description }).select().single();
    if (error) throw new Error(error.message);
    return { election: created };
  });

export const adminActivateElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify has positions + candidates
    const { data: positions } = await supabaseAdmin.from("positions").select("id").eq("election_id", data.electionId);
    if (!positions || positions.length === 0) throw new Error("Add at least one position before activating.");
    const { data: cands } = await supabaseAdmin.from("candidates").select("id, position_id");
    const posIds = new Set(positions.map((p) => p.id));
    const perPos = new Map<string, number>();
    for (const c of cands ?? []) if (posIds.has(c.position_id)) perPos.set(c.position_id, (perPos.get(c.position_id) ?? 0) + 1);
    for (const p of positions) if ((perPos.get(p.id) ?? 0) < 2) throw new Error("Every position needs at least two candidates.");
    // End any other active election
    const { data: others } = await supabaseAdmin.from("elections").select("id").eq("status", "active");
    for (const o of others ?? []) {
      if (o.id === data.electionId) continue;
      await supabaseAdmin.from("elections").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", o.id);
      await supabaseAdmin.rpc("terminate_election_tickets", { _election_id: o.id });
    }
    const { error } = await supabaseAdmin.from("elections")
      .update({ status: "active", activated_at: new Date().toISOString(), ended_at: null })
      .eq("id", data.electionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminEndElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("elections")
      .update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", data.electionId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("terminate_election_tickets", { _election_id: data.electionId });
    return { ok: true };
  });

export const adminDeleteElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("elections").delete().eq("id", data.electionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    electionId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(""),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: max } = await supabaseAdmin.from("positions")
      .select("display_order").eq("election_id", data.electionId).order("display_order", { ascending: false }).limit(1).maybeSingle();
    const order = (max?.display_order ?? 0) + 1;
    const { data: inserted, error } = await supabaseAdmin.from("positions")
      .insert({ election_id: data.electionId, name: data.name, description: data.description, display_order: order })
      .select().single();
    if (error) throw new Error(error.message);
    return { position: inserted };
  });

export const adminRemovePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ positionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("positions").delete().eq("id", data.positionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    positionId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(500).default(""),
    photoUrl: z.string().trim().url().optional().or(z.literal("")),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const photo_url = data.photoUrl && data.photoUrl.length > 0
      ? data.photoUrl
      : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(data.name)}&backgroundColor=B4FF39&fontFamily=Inter`;
    const { data: inserted, error } = await supabaseAdmin.from("candidates")
      .insert({ position_id: data.positionId, name: data.name, bio: data.bio, photo_url })
      .select().single();
    if (error) throw new Error(error.message);
    return { candidate: inserted };
  });

export const adminRemoveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ candidateId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("candidates").delete().eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid().optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: tickets }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
      data.electionId
        ? supabaseAdmin.from("voting_tickets").select("*").eq("election_id", data.electionId)
        : Promise.resolve({ data: [] as { id: string; user_id: string; code: string; status: string; election_id: string }[] }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role); roleMap.set(r.user_id, arr);
    }
    const ticketMap = new Map<string, { code: string; status: string }>();
    for (const t of (tickets ?? [])) ticketMap.set(t.user_id, { code: t.code, status: t.status });
    return {
      users: (profiles ?? []).map((p) => ({
        id: p.id, full_name: p.full_name, email: p.email, created_at: p.created_at,
        roles: roleMap.get(p.id) ?? [],
        ticket: ticketMap.get(p.id) ?? null,
      })),
    };
  });

export const adminIssueTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    electionId: z.string().uuid(),
    userIds: z.array(z.string().uuid()).min(1).max(500),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("voting_tickets")
      .select("user_id").eq("election_id", data.electionId).in("user_id", data.userIds);
    const skip = new Set((existing ?? []).map((e) => e.user_id));
    const toInsert = data.userIds
      .filter((u) => !skip.has(u))
      .map((u) => ({ election_id: data.electionId, user_id: u, code: genCode(8), status: "active" as const }));
    if (toInsert.length === 0) return { issued: 0, skipped: skip.size };
    const { error } = await supabaseAdmin.from("voting_tickets").insert(toInsert);
    if (error) throw new Error(error.message);
    return { issued: toInsert.length, skipped: skip.size };
  });

export const adminIssueAllTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ electionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: users }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("voting_tickets").select("user_id").eq("election_id", data.electionId),
    ]);
    const have = new Set((existing ?? []).map((e) => e.user_id));
    const rows = (users ?? []).filter((u) => !have.has(u.id))
      .map((u) => ({ election_id: data.electionId, user_id: u.id, code: genCode(8), status: "active" as const }));
    if (rows.length === 0) return { issued: 0 };
    const { error } = await supabaseAdmin.from("voting_tickets").insert(rows);
    if (error) throw new Error(error.message);
    return { issued: rows.length };
  });

export const adminRevokeTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ticketId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("voting_tickets")
      .update({ status: "terminated" }).eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
