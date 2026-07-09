import { createServerFn } from "@tanstack/react-start";
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

const GENESIS_HASH =
  "0x9f3ac2b1e8d47c50a1b6f9d2c7e83b04a12f7e6d5b8c9a0e3f1d2c4b6a8e0f2c";

// ---------- Request one-time code ----------
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ voterId: z.string().trim().min(3).max(40) }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const voterId = data.voterId.toUpperCase();

    const { data: voter, error: vErr } = await supabaseAdmin
      .from("voters")
      .select("voter_id, phone_mask, has_voted")
      .eq("voter_id", voterId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!voter) throw new Error("Voter ID not on the register.");
    if (voter.has_voted) throw new Error("This voter has already cast a ballot.");

    // Rate limit: max 3 codes issued in the last 15 minutes
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("otps")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", voterId)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Too many code requests. Try again in 15 minutes.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256Hex(`${voterId}:${code}`);
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error: iErr } = await supabaseAdmin
      .from("otps")
      .insert({ voter_id: voterId, code_hash, expires_at });
    if (iErr) throw new Error(iErr.message);

    // Demo mode: return the code so the voter can proceed without SMS wiring.
    return { phoneMask: voter.phone_mask, devCode: code };
  });

// ---------- Verify code, issue cast token ----------
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      voterId: z.string().trim().min(3).max(40),
      code: z.string().trim().regex(/^\d{6}$/),
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const voterId = data.voterId.toUpperCase();
    const code_hash = await sha256Hex(`${voterId}:${data.code}`);

    const { data: otp, error } = await supabaseAdmin
      .from("otps")
      .select("id, expires_at, used")
      .eq("voter_id", voterId)
      .eq("code_hash", code_hash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!otp) throw new Error("Code is incorrect.");
    if (otp.used) throw new Error("This code has already been used.");
    if (new Date(otp.expires_at).getTime() < Date.now())
      throw new Error("This code has expired. Request a new one.");

    await supabaseAdmin.from("otps").update({ used: true }).eq("id", otp.id);

    const token = "bsig_" + randHex(28);
    const expires_at = new Date(Date.now() + 20 * 60_000).toISOString();
    const { error: tErr } = await supabaseAdmin
      .from("cast_tokens")
      .insert({ token, voter_id: voterId, expires_at });
    if (tErr) throw new Error(tErr.message);

    return { castToken: token };
  });

// ---------- Cast ballot ----------
const selectionsSchema = z.record(z.string().min(1), z.string().min(1));

export const castBallot = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({
      castToken: z.string().min(10),
      selections: selectionsSchema,
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate token
    const { data: tok, error } = await supabaseAdmin
      .from("cast_tokens")
      .select("token, voter_id, expires_at, used")
      .eq("token", data.castToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tok) throw new Error("Invalid cast token.");
    if (tok.used) throw new Error("This cast token has already been used.");
    if (new Date(tok.expires_at).getTime() < Date.now())
      throw new Error("Cast token has expired. Please re-verify.");

    // Compute prev hash from last ballot
    const { data: last } = await supabaseAdmin
      .from("ballots")
      .select("entry_hash")
      .order("entry_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prev_hash = last?.entry_hash ?? GENESIS_HASH;

    const selectionsCanonical = JSON.stringify(
      Object.keys(data.selections).sort().reduce<Record<string, string>>((o, k) => {
        o[k] = data.selections[k];
        return o;
      }, {}),
    );
    const nonce = randHex(16);
    const entry_hash = "0x" + (await sha256Hex(`${prev_hash}|${selectionsCanonical}|${nonce}`)).slice(0, 40);
    const receipt_hash = "0x" + (await sha256Hex(`${entry_hash}|${nonce}|receipt`)).slice(0, 40);
    const token_fingerprint = (await sha256Hex(data.castToken)).slice(0, 22);

    // Consume token + mark voter voted + insert ballot
    const { error: uErr } = await supabaseAdmin
      .from("cast_tokens")
      .update({ used: true })
      .eq("token", data.castToken)
      .eq("used", false);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("voters").update({ has_voted: true }).eq("voter_id", tok.voter_id);

    const { data: inserted, error: bErr } = await supabaseAdmin
      .from("ballots")
      .insert({
        receipt_hash,
        prev_hash,
        entry_hash,
        token_fingerprint,
        selections: data.selections,
      })
      .select("entry_index, created_at")
      .single();
    if (bErr) throw new Error(bErr.message);

    return {
      receiptHash: receipt_hash,
      entryHash: entry_hash,
      prevHash: prev_hash,
      tokenFingerprint: token_fingerprint,
      index: inserted.entry_index,
      timestamp: inserted.created_at,
    };
  });

// ---------- Public reads (via publishable client + anon SELECT policy) ----------
function publicClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

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
      .ilike("receipt_hash", `${q}%`)
      .limit(1);
    if (error) throw new Error(error.message);
    return { entry: rows?.[0] ?? null };
  });

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [{ count: castCount }, { count: eligible }] = await Promise.all([
    supabase.from("ballots").select("entry_index", { count: "exact", head: true }),
    supabase.from("voters").select("voter_id", { count: "exact", head: true }),
  ]);
  // voters table is service-role only; eligible fallback:
  return { castCount: castCount ?? 0, eligible: eligible ?? 0 };
});
