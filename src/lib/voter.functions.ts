import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── helpers ────────────────────────────────────────────────────────────────
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required.");
}

/** Normalize a phone number to E.164.
 *  Handles common Ghanaian formats:
 *    0244123456  → +233244123456
 *    233244123456 → +233244123456
 *    +233244123456 → +233244123456
 *  Returns null if the result doesn't look like a valid E.164 number.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  let e164: string;
  if (digits.startsWith("+")) {
    e164 = digits;
  } else if (digits.startsWith("00")) {
    e164 = "+" + digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Assume Ghana (+233) — adjust default country code here if needed
    e164 = "+233" + digits.slice(1);
  } else if (digits.startsWith("233")) {
    e164 = "+" + digits;
  } else {
    e164 = "+" + digits;
  }
  // E.164: + followed by 7–15 digits
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

/** SHA-256 hex digest (Web Crypto — works in both Node and edge) */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cryptographically random hex string of `bytes` bytes */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 6-digit numeric OTP */
function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

// ─── Arkesel SMS ─────────────────────────────────────────────────────────────
// TODO: Set ARKESEL_API_KEY in your environment variables.
// Arkesel API docs: https://developers.arkesel.com
// Replace the sender name "VoteWise" with your registered sender ID if needed.

async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    // In development without a key, just log — remove this branch in production
    console.warn(`[SMS stub] To: ${to} | Message: ${message}`);
    return;
  }
  const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: "VoteWise",   // change to your registered Arkesel sender ID
      message,
      recipients: [to],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SMS delivery failed (${res.status}): ${body}`);
  }
}

// ─── ADMIN: upload eligible voters ──────────────────────────────────────────

export const adminUploadVoters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      electionId: z.string().uuid(),
      /** Raw CSV text — expected columns: full_name, phone_number (header row required) */
      csvText: z.string().min(1).max(5_000_000),
    }).parse(raw)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Parse CSV (simple — handles quoted fields with commas)
    const lines = data.csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    const nameIdx  = header.findIndex((h) => h.includes("name"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("number"));
    if (nameIdx === -1 || phoneIdx === -1)
      throw new Error("CSV must have columns: full_name, phone_number");

    const accepted: { full_name: string; phone_number: string; election_id: string; uploaded_by: string }[] = [];
    const rejected: { row: number; raw_name: string; raw_phone: string; reason: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const rawName  = (cols[nameIdx]  ?? "").trim();
      const rawPhone = (cols[phoneIdx] ?? "").trim();

      if (!rawName) { rejected.push({ row: i + 1, raw_name: rawName, raw_phone: rawPhone, reason: "Missing name" }); continue; }
      const phone = normalizePhone(rawPhone);
      if (!phone)   { rejected.push({ row: i + 1, raw_name: rawName, raw_phone: rawPhone, reason: "Invalid phone number" }); continue; }

      accepted.push({ full_name: rawName, phone_number: phone, election_id: data.electionId, uploaded_by: context.userId });
    }

    // Bulk upsert — duplicate phones in same election are skipped (counted as rejected)
    let dbAccepted = 0;
    let dbRejected = 0;
    if (accepted.length > 0) {
      const { data: inserted, error } = await supabaseAdmin
        .from("eligible_voters")
        .upsert(accepted, { onConflict: "election_id,phone_number", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      dbAccepted = inserted?.length ?? 0;
      dbRejected = accepted.length - dbAccepted;
    }

    // Audit log
    await supabaseAdmin.from("voter_upload_audit").insert({
      election_id: data.electionId,
      uploaded_by: context.userId,
      total_rows: accepted.length + rejected.length,
      accepted: dbAccepted,
      rejected: rejected.length + dbRejected,
    });

    return {
      totalRows: accepted.length + rejected.length,
      accepted: dbAccepted,
      rejected: rejected.length + dbRejected,
      rejectedRows: rejected,
    };
  });

// ─── ADMIN: list eligible voters ────────────────────────────────────────────

export const adminListEligibleVoters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      electionId: z.string().uuid(),
      search: z.string().trim().max(100).default(""),
    }).parse(raw)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("eligible_voters")
      .select("id, full_name, phone_number, has_voted, voted_at, created_at")
      .eq("election_id", data.electionId)
      .order("created_at", { ascending: false });
    if (data.search) q = q.ilike("full_name", `%${data.search}%`);
    const { data: voters, error } = await q;
    if (error) throw new Error(error.message);
    return { voters: voters ?? [] };
  });

// ─── ADMIN: edit eligible voter phone ───────────────────────────────────────

export const adminEditEligibleVoter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      voterId: z.string().uuid(),
      fullName: z.string().trim().min(2).max(120).optional(),
      phoneNumber: z.string().trim().min(7).max(20).optional(),
    }).parse(raw)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const update: { full_name?: string; phone_number?: string } = {};
    if (data.fullName)    update.full_name    = data.fullName;
    if (data.phoneNumber) {
      const phone = normalizePhone(data.phoneNumber);
      if (!phone) throw new Error("Invalid phone number format.");
      update.phone_number = phone;
    }
    if (Object.keys(update).length === 0) throw new Error("Nothing to update.");

    const { error } = await supabaseAdmin.from("eligible_voters").update(update).eq("id", data.voterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── ADMIN: remove eligible voter ───────────────────────────────────────────

export const adminRemoveEligibleVoter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ voterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("eligible_voters").delete().eq("id", data.voterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── VOTER: lookup by name + phone ──────────────────────────────────────────

export const voterLookup = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId: z.string().uuid(),
      fullName:   z.string().trim().min(1).max(120),
      phone:      z.string().trim().min(7).max(20),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone = normalizePhone(data.phone);
    // Generic error — never reveal which field matched/didn't
    const genericErr = "We couldn't verify these details. Please check with the election administrator.";
    if (!phone) throw new Error(genericErr);

    const { data: voter } = await supabaseAdmin
      .from("eligible_voters")
      .select("id, full_name, phone_number, has_voted, election_id")
      .eq("election_id", data.electionId)
      .eq("phone_number", phone)
      .maybeSingle();

    if (!voter) throw new Error(genericErr);

    // Mask phone for confirmation display: +233244•••456
    const masked = voter.phone_number.slice(0, -3).replace(/\d(?=\d{3})/g, (_, i) =>
      i >= voter.phone_number.length - 7 ? "•" : voter.phone_number[i]
    ) + voter.phone_number.slice(-3);

    return {
      voterId:     voter.id,
      displayName: voter.full_name,
      maskedPhone: masked,
      hasVoted:    voter.has_voted,
    };
  });

// ─── VOTER: send OTP ─────────────────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_SENDS      = 2;   // max OTP requests per voter per election

export const voterSendOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId: z.string().uuid(),
      voterId:    z.string().uuid(),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch voter + election
    const { data: voter } = await supabaseAdmin
      .from("eligible_voters")
      .select("id, full_name, phone_number, has_voted, election_id")
      .eq("id", data.voterId)
      .eq("election_id", data.electionId)
      .maybeSingle();
    if (!voter) throw new Error("Voter not found.");
    if (voter.has_voted) throw new Error("You have already voted in this election.");

    const { data: election } = await supabaseAdmin
      .from("elections").select("status, title").eq("id", data.electionId).maybeSingle();
    if (!election || election.status !== "active")
      throw new Error("This election is not currently active.");

    // Rate-limit: count OTP requests in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_requests")
      .select("id", { count: "exact", head: true })
      .eq("eligible_voter_id", data.voterId)
      .gte("created_at", since);
    if ((count ?? 0) >= OTP_MAX_SENDS)
      throw new Error(`OTP limit reached. You may only request ${OTP_MAX_SENDS} codes per day. Contact the election administrator if you need help.`);

    // Generate OTP
    const otp      = generateOtp();
    const codeHash = await sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabaseAdmin.from("otp_requests").insert({
      eligible_voter_id: data.voterId,
      election_id:       data.electionId,
      code_hash:         codeHash,
      expires_at:        expiresAt,
    });

    // Send SMS via Arkesel
    const message = `Your VoteWise verification code for "${election.title}" is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
    await sendSms(voter.phone_number, message);

    return { ok: true, expiresAt };
  });

// ─── VOTER: verify OTP → issue scoped session token ─────────────────────────

const OTP_MAX_ATTEMPTS    = 5;
const SESSION_EXPIRY_MINS = 30;

export const voterVerifyOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId: z.string().uuid(),
      voterId:    z.string().uuid(),
      otp:        z.string().trim().length(6).regex(/^\d{6}$/),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const enteredHash = await sha256(data.otp);

    // Get the most recent unused, unexpired OTP for this voter
    const { data: otpRow } = await supabaseAdmin
      .from("otp_requests")
      .select("id, code_hash, expires_at, is_used, attempts")
      .eq("eligible_voter_id", data.voterId)
      .eq("election_id", data.electionId)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) throw new Error("No valid OTP found. Please request a new code.");
    if (otpRow.attempts >= OTP_MAX_ATTEMPTS)
      throw new Error("Too many incorrect attempts. Please request a new OTP.");

    if (otpRow.code_hash !== enteredHash) {
      await supabaseAdmin
        .from("otp_requests")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);
      const remaining = OTP_MAX_ATTEMPTS - otpRow.attempts - 1;
      throw new Error(`Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
    }

    // Mark OTP used
    await supabaseAdmin.from("otp_requests").update({ is_used: true }).eq("id", otpRow.id);

    // Issue scoped session token
    const rawToken  = randomHex(32);
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINS * 60 * 1000).toISOString();

    await supabaseAdmin.from("voter_sessions").insert({
      eligible_voter_id: data.voterId,
      election_id:       data.electionId,
      token_hash:        tokenHash,
      expires_at:        expiresAt,
    });

    return { sessionToken: rawToken, expiresAt };
  });

// ─── VOTER: get ballot (requires valid session token) ────────────────────────

export const voterGetBallot = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId:   z.string().uuid(),
      sessionToken: z.string().min(10),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokenHash = await sha256(data.sessionToken);
    const { data: session } = await supabaseAdmin
      .from("voter_sessions")
      .select("id, eligible_voter_id, election_id, is_used, expires_at")
      .eq("token_hash", tokenHash)
      .eq("election_id", data.electionId)
      .maybeSingle();

    if (!session || session.is_used || new Date(session.expires_at) < new Date())
      throw new Error("Session expired or invalid. Please log in again.");

    const { data: voter } = await supabaseAdmin
      .from("eligible_voters")
      .select("full_name, has_voted")
      .eq("id", session.eligible_voter_id)
      .maybeSingle();
    if (voter?.has_voted) throw new Error("You have already voted in this election.");

    const [elRes, posRes, candRes] = await Promise.all([
      supabaseAdmin.from("elections").select("id, title, description, election_type, status").eq("id", data.electionId).single(),
      supabaseAdmin.from("positions").select("id, name, description, display_order").eq("election_id", data.electionId).order("display_order"),
      supabaseAdmin.from("candidates").select("id, name, bio, photo_url, position_id"),
    ]);
    if (elRes.error) throw new Error(elRes.error.message);

    const positions = posRes.data ?? [];
    const posIds    = new Set(positions.map((p) => p.id));
    const candidates = (candRes.data ?? []).filter((c) => posIds.has(c.position_id));

    return {
      election:   elRes.data,
      positions,
      candidates,
      voterName:  voter?.full_name ?? "",
    };
  });

// ─── VOTER: cast ballot ──────────────────────────────────────────────────────

export const voterCastBallot = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId:   z.string().uuid(),
      sessionToken: z.string().min(10),
      selections:   z.record(z.string().uuid(), z.string().uuid()), // position_id → candidate_id
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build selections array for the DB function
    const selectionsArr = Object.entries(data.selections).map(([position_id, candidate_id]) => ({
      position_id,
      candidate_id,
    }));

    const { data: receiptCode, error } = await supabaseAdmin.rpc("cast_voter_ballot", {
      _session_token: data.sessionToken,
      _selections:    selectionsArr,
    });
    if (error) throw new Error(error.message);

    // Fetch election title for receipt display
    const { data: election } = await supabaseAdmin
      .from("elections").select("title").eq("id", data.electionId).maybeSingle();

    // Optionally send receipt via SMS — fetch voter phone from session
    const tokenHash = await sha256(data.sessionToken);
    const { data: session } = await supabaseAdmin
      .from("voter_sessions")
      .select("eligible_voter_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (session) {
      const { data: voter } = await supabaseAdmin
        .from("eligible_voters")
        .select("phone_number, full_name")
        .eq("id", session.eligible_voter_id)
        .maybeSingle();
      if (voter) {
        const smsMsg = `VoteWise Receipt\nElection: ${election?.title ?? ""}\nReceipt code: ${receiptCode}\nYour vote has been recorded. Keep this code to verify your vote was counted after the election closes.`;
        // Fire-and-forget — don't fail the vote if SMS fails
        sendSms(voter.phone_number, smsMsg).catch((e) => console.error("[SMS receipt]", e));
      }
    }

    return {
      receiptCode: receiptCode as string,
      electionTitle: election?.title ?? "",
      castAt: new Date().toISOString(),
    };
  });

// ─── VOTER: verify receipt ───────────────────────────────────────────────────

export const voterVerifyReceipt = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      electionId:  z.string().uuid(),
      receiptCode: z.string().trim().min(4).max(20),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: receipt } = await supabaseAdmin
      .from("vote_receipts")
      .select("receipt_code, vote_uuid, cast_at, election_id")
      .eq("election_id", data.electionId)
      .eq("receipt_code", data.receiptCode.toUpperCase())
      .maybeSingle();
    if (!receipt) return { found: false };
    return {
      found:       true,
      receiptCode: receipt.receipt_code,
      castAt:      receipt.cast_at,
    };
  });
