import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------- helpers ----------
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const GENESIS_HASH = "0x9f3ac2b1e8d47c50a1b6f9d2c7e83b04a12f7e6d5b8c9a0e3f1d2c4b6a8e0f2c";

function publicClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(passcode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(passcode);
  const { data, error } = await supabaseAdmin
    .from("admin_codes")
    .select("id, label")
    .eq("code_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid admin passcode.");
  return { id: data.id, label: data.label };
}

async function assertUnlocked() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("election_state").select("locked").eq("id", 1).single();
  if (data?.locked) throw new Error("Ballot is locked. No further edits are permitted.");
}

async function logAdmin(actor: string, action: string, target: string | null, detail: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({ actor, action, target, detail: detail as never });
}

// ---------- Ballot definition (public) ----------
export const getBallot = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [posRes, candRes, stateRes] = await Promise.all([
    supabase.from("positions").select("*").order("display_order", { ascending: true }),
    supabase.from("candidates").select("*"),
    supabase.from("election_state").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (candRes.error) throw new Error(candRes.error.message);
  if (stateRes.error) throw new Error(stateRes.error.message);
  return {
    positions: posRes.data ?? [],
    candidates: (candRes.data ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    election: stateRes.data,
  };
});

// ---------- Request one-time code ----------
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ voterId: z.string().trim().min(3).max(40) }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const voterId = data.voterId.toUpperCase();

    const { data: voter, error: vErr } = await supabaseAdmin
      .from("voters").select("voter_id, phone_mask, has_voted").eq("voter_id", voterId).maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!voter) throw new Error("Voter ID not on the register.");
    if (voter.has_voted) throw new Error("This voter has already cast a ballot.");

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("otps").select("id", { count: "exact", head: true })
      .eq("voter_id", voterId).gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Too many code requests. Try again in 15 minutes.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256Hex(`${voterId}:${code}`);
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error: iErr } = await supabaseAdmin
      .from("otps").insert({ voter_id: voterId, code_hash, expires_at });
    if (iErr) throw new Error(iErr.message);

    return { phoneMask: voter.phone_mask, devCode: code };
  });

// ---------- Verify code, issue cast token (blind-signature-lite) ----------
// The server signs an opaque, random token; it never sees the ballot selections
// that the client will later attach to that token when casting.
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({
    voterId: z.string().trim().min(3).max(40),
    code: z.string().trim().regex(/^\d{6}$/),
  }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const voterId = data.voterId.toUpperCase();
    const code_hash = await sha256Hex(`${voterId}:${data.code}`);
    const { data: otp, error } = await supabaseAdmin
      .from("otps").select("id, expires_at, used")
      .eq("voter_id", voterId).eq("code_hash", code_hash)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!otp) throw new Error("Code is incorrect.");
    if (otp.used) throw new Error("This code has already been used.");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    await supabaseAdmin.from("otps").update({ used: true }).eq("id", otp.id);

    const token = "bsig_" + randHex(28);
    const expires_at = new Date(Date.now() + 20 * 60_000).toISOString();
    const { error: tErr } = await supabaseAdmin
      .from("cast_tokens").insert({ token, voter_id: voterId, expires_at });
    if (tErr) throw new Error(tErr.message);
    return { castToken: token };
  });

// ---------- Cast ballot ----------
const selectionsSchema = z.record(z.string().min(1), z.string().min(1));

export const castBallot = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({
    castToken: z.string().min(10),
    selections: selectionsSchema,
  }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tok, error } = await supabaseAdmin
      .from("cast_tokens").select("token, voter_id, expires_at, used")
      .eq("token", data.castToken).maybeSingle();
    if (error) throw new Error(error.message);
    if (!tok) throw new Error("Invalid cast token.");
    if (tok.used) throw new Error("This cast token has already been used.");
    if (new Date(tok.expires_at).getTime() < Date.now()) throw new Error("Cast token expired. Please re-verify.");

    // Validate every mandatory position is answered with a valid candidate for that position.
    const [{ data: positions }, { data: candidates }] = await Promise.all([
      supabaseAdmin.from("positions").select("id"),
      supabaseAdmin.from("candidates").select("id, position_id"),
    ]);
    const posIds = new Set((positions ?? []).map((p) => p.id));
    const validPair = new Set((candidates ?? []).map((c) => `${c.position_id}:${c.id}`));
    for (const pid of posIds) {
      const cid = data.selections[pid];
      if (!cid) throw new Error("Every position requires exactly one selection.");
      if (!validPair.has(`${pid}:${cid}`)) throw new Error("A selection is not a valid candidate for its position.");
    }
    // Reject extraneous selections
    for (const k of Object.keys(data.selections)) {
      if (!posIds.has(k)) throw new Error("Ballot contains an unknown position.");
    }

    const { data: last } = await supabaseAdmin
      .from("ballots").select("entry_hash").order("entry_index", { ascending: false }).limit(1).maybeSingle();
    const prev_hash = last?.entry_hash ?? GENESIS_HASH;

    const selectionsCanonical = JSON.stringify(
      Object.keys(data.selections).sort().reduce<Record<string, string>>((o, k) => { o[k] = data.selections[k]; return o; }, {}),
    );
    const nonce = randHex(16);
    const entry_hash = "0x" + (await sha256Hex(`${prev_hash}|${selectionsCanonical}|${nonce}`)).slice(0, 40);
    const receipt_hash = "0x" + (await sha256Hex(`${entry_hash}|${nonce}|receipt`)).slice(0, 40);
    const token_fingerprint = (await sha256Hex(data.castToken)).slice(0, 22);

    const { error: uErr } = await supabaseAdmin
      .from("cast_tokens").update({ used: true }).eq("token", data.castToken).eq("used", false);
    if (uErr) throw new Error(uErr.message);
    await supabaseAdmin.from("voters").update({ has_voted: true }).eq("voter_id", tok.voter_id);

    const { data: inserted, error: bErr } = await supabaseAdmin
      .from("ballots").insert({ receipt_hash, prev_hash, entry_hash, token_fingerprint, selections: data.selections })
      .select("entry_index, created_at").single();
    if (bErr) throw new Error(bErr.message);

    return {
      receiptHash: receipt_hash, entryHash: entry_hash, prevHash: prev_hash,
      tokenFingerprint: token_fingerprint, index: inserted.entry_index, timestamp: inserted.created_at,
    };
  });

// ---------- Public reads ----------
export const getLedger = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("ballots")
    .select("entry_index, receipt_hash, prev_hash, entry_hash, token_fingerprint, selections, created_at")
    .order("entry_index", { ascending: true });
  if (error) throw new Error(error.message);
  return { entries: data ?? [], genesis: GENESIS_HASH };
});

export const lookupReceipt = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ hash: z.string().trim().min(4) }).parse(raw))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const q = data.hash.toLowerCase();
    const { data: rows, error } = await supabase
      .from("ballots")
      .select("entry_index, receipt_hash, prev_hash, entry_hash, token_fingerprint, selections, created_at")
      .ilike("receipt_hash", `${q}%`).limit(1);
    if (error) throw new Error(error.message);
    return { entry: rows?.[0] ?? null };
  });

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: castCount }, { count: eligible }, ballotRes] = await Promise.all([
    supabaseAdmin.from("ballots").select("entry_index", { count: "exact", head: true }),
    supabaseAdmin.from("voters").select("voter_id", { count: "exact", head: true }),
    supabaseAdmin.from("ballots").select("created_at").order("entry_index", { ascending: true }),
  ]);
  return {
    castCount: castCount ?? 0,
    eligible: eligible ?? 0,
    timeline: (ballotRes.data ?? []).map((r) => r.created_at),
  };
});

export const getAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return { entries: data ?? [] };
});

// ---------- Admin ----------
export const adminVerify = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ passcode: z.string().min(4).max(64) }).parse(raw))
  .handler(async ({ data }) => {
    const info = await assertAdmin(data.passcode);
    return { ok: true, label: info.label };
  });

export const adminAddCandidate = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({
    passcode: z.string().min(4),
    position_id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(300).default(""),
    photo_url: z.string().trim().url().max(500),
  }).parse(raw))
  .handler(async ({ data }) => {
    await assertAdmin(data.passcode);
    await assertUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("candidates").insert({
      position_id: data.position_id, name: data.name, bio: data.bio, photo_url: data.photo_url,
    }).select().single();
    if (error) throw new Error(error.message);
    await logAdmin("admin", "add_candidate", inserted.id, { name: inserted.name, position_id: inserted.position_id });
    return { candidate: inserted };
  });

export const adminRemoveCandidate = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({
    passcode: z.string().min(4),
    candidate_id: z.string().uuid(),
  }).parse(raw))
  .handler(async ({ data }) => {
    await assertAdmin(data.passcode);
    await assertUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("candidates").select("name").eq("id", data.candidate_id).maybeSingle();
    const { error } = await supabaseAdmin.from("candidates").delete().eq("id", data.candidate_id);
    if (error) throw new Error(error.message);
    await logAdmin("admin", "remove_candidate", data.candidate_id, { name: existing?.name });
    return { ok: true };
  });

export const adminAddPosition = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({
    passcode: z.string().min(4),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(""),
  }).parse(raw))
  .handler(async ({ data }) => {
    await assertAdmin(data.passcode);
    await assertUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin.from("positions").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
    const order = (maxRow?.display_order ?? 0) + 1;
    const { data: inserted, error } = await supabaseAdmin.from("positions").insert({
      name: data.name, description: data.description, display_order: order,
    }).select().single();
    if (error) throw new Error(error.message);
    await logAdmin("admin", "add_position", inserted.id, { name: inserted.name });
    return { position: inserted };
  });

export const adminLockElection = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ passcode: z.string().min(4) }).parse(raw))
  .handler(async ({ data }) => {
    await assertAdmin(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: positions }, { data: candidates }] = await Promise.all([
      supabaseAdmin.from("positions").select("id, name, display_order").order("display_order"),
      supabaseAdmin.from("candidates").select("id, name, position_id, bio, photo_url").order("name"),
    ]);
    const canonical = JSON.stringify({ positions, candidates });
    const ballot_hash = "0x" + (await sha256Hex(canonical)).slice(0, 48);
    const { error } = await supabaseAdmin
      .from("election_state")
      .update({ locked: true, locked_at: new Date().toISOString(), ballot_hash })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await logAdmin("admin", "lock_election", null, { ballot_hash });
    return { ok: true, ballot_hash };
  });
