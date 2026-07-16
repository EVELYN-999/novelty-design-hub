import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import {
  voterLookup, voterSendOtp, voterVerifyOtp,
  voterGetBallot, voterCastBallot, voterVerifyReceipt,
} from "@/lib/voter.functions";
import {
  Phone, CheckCircle2, Loader2, ArrowRight, AlertTriangle,
  RotateCcw, ShieldCheck, Copy, Check, Search,
} from "lucide-react";

export const Route = createFileRoute("/vote-public")({
  component: VotePublicPage,
  validateSearch: (s: Record<string, unknown>) => ({
    election: (s.election as string | undefined) ?? "",
  }),
  head: () => ({
    meta: [
      { title: "Cast Your Vote · VoteWise" },
      { name: "description", content: "Verify your identity and cast your ballot." },
    ],
  }),
});

type Step = "lookup" | "confirm" | "otp" | "ballot" | "receipt";

interface LookupResult {
  voterId: string;
  displayName: string;
  maskedPhone: string;
  hasVoted: boolean;
}

interface BallotData {
  election: { id: string; title: string; description: string; election_type?: string; status: string };
  positions: { id: string; name: string; description: string; display_order: number }[];
  candidates: { id: string; name: string; bio: string; photo_url: string; position_id: string }[];
  voterName: string;
}

interface ReceiptData {
  receiptCode: string;
  electionTitle: string;
  castAt: string;
}

function VotePublicPage() {
  const { election: electionId } = Route.useSearch();

  const lookupFn      = useServerFn(voterLookup);
  const sendOtpFn     = useServerFn(voterSendOtp);
  const verifyOtpFn   = useServerFn(voterVerifyOtp);
  const getBallotFn   = useServerFn(voterGetBallot);
  const castBallotFn  = useServerFn(voterCastBallot);
  const verifyReceiptFn = useServerFn(voterVerifyReceipt);

  const [step, setStep]               = useState<Step>("lookup");
  const [err, setErr]                 = useState<string | null>(null);
  const [busy, setBusy]               = useState(false);

  // Step 1 — lookup
  const [fullName, setFullName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  // Step 3 — OTP
  const [otp, setOtp]                 = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [otpExpiry, setOtpExpiry]     = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(0);

  // Step 4 — ballot
  const [ballot, setBallot]           = useState<BallotData | null>(null);
  const [selections, setSelections]   = useState<Record<string, string>>({});

  // Step 5 — receipt
  const [receipt, setReceipt]         = useState<ReceiptData | null>(null);
  const [copied, setCopied]           = useState(false);

  // Receipt verify panel
  const [verifyCode, setVerifyCode]   = useState("");
  const [verifyResult, setVerifyResult] = useState<{ found: boolean; castAt?: string } | null>(null);

  function reset() {
    setStep("lookup"); setErr(null); setFullName(""); setPhone("");
    setLookupResult(null); setOtp(""); setSessionToken(""); setOtpExpiry(null);
    setResendCount(0); setBallot(null); setSelections({}); setReceipt(null);
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!electionId) { setErr("No election ID in URL. Use the link provided by your election administrator."); return; }
    setErr(null); setBusy(true);
    try {
      const res = await lookupFn({ data: { electionId, fullName, phone } });
      setLookupResult(res);
      setStep("confirm");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function handleSendOtp() {
    if (!lookupResult || !electionId) return;
    setErr(null); setBusy(true);
    try {
      const res = await sendOtpFn({ data: { electionId, voterId: lookupResult.voterId } });
      setOtpExpiry(res.expiresAt);
      setResendCount((n) => n + 1);
      setStep("otp");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupResult || !electionId) return;
    setErr(null); setBusy(true);
    try {
      const res = await verifyOtpFn({ data: { electionId, voterId: lookupResult.voterId, otp } });
      setSessionToken(res.sessionToken);
      // Load ballot
      const ballotData = await getBallotFn({ data: { electionId, sessionToken: res.sessionToken } });
      setBallot(ballotData);
      setStep("ballot");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function handleCastBallot() {
    if (!ballot || !electionId) return;
    setErr(null); setBusy(true);
    try {
      const res = await castBallotFn({ data: { electionId, sessionToken, selections } });
      setReceipt(res);
      setStep("receipt");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function handleVerifyReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!electionId) return;
    setErr(null); setBusy(true);
    try {
      const res = await verifyReceiptFn({ data: { electionId, receiptCode: verifyCode } });
      setVerifyResult(res);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  }

  async function copyReceipt() {
    if (!receipt) return;
    await navigator.clipboard.writeText(receipt.receiptCode);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const positions   = ballot?.positions ?? [];
  const candidates  = ballot?.candidates ?? [];
  const complete    = positions.length > 0 && positions.every((p) => selections[p.id]);
  const selectedCount = Object.keys(selections).length;

  // ── No election ID in URL ──────────────────────────────────────────────────
  if (!electionId) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-5 py-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-warn mb-4" />
          <h1 className="font-display text-2xl font-bold">No election specified</h1>
          <p className="mt-3 text-fg-dim text-sm">Use the voting link provided by your election administrator.</p>
          <Link to="/" className="btn-primary mt-8 inline-flex">Back to home</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-5 py-12">

        {/* ── Step indicator ─────────────────────────────────────────────── */}
        {step !== "receipt" && (
          <div className="flex items-center gap-0 mb-8">
            {(["lookup", "confirm", "otp", "ballot"] as Step[]).map((s, i) => {
              const steps: Step[] = ["lookup", "confirm", "otp", "ballot"];
              const idx = steps.indexOf(step);
              const done = i < idx;
              const active = s === step;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className={`w-7 h-7 border flex items-center justify-center label text-xs flex-shrink-0 ${
                    done ? "border-accent bg-accent text-bg" :
                    active ? "border-accent text-accent" : "border-line text-fg-mute"
                  }`}>
                    {done ? <Check size={12} /> : i + 1}
                  </div>
                  {i < 3 && <div className={`flex-1 h-px ${done ? "bg-accent" : "bg-line"}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {err && (
          <div className="mb-5 border border-danger/50 bg-danger/5 p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{err}</p>
          </div>
        )}

        {/* ══ STEP 1: Name + Phone ══════════════════════════════════════════ */}
        {step === "lookup" && (
          <div className="panel p-8">
            <div className="label text-xs mb-1">Step 1 of 4</div>
            <h1 className="font-display text-3xl font-black mb-2">Verify your identity</h1>
            <p className="text-sm text-fg-dim mb-6">Enter the name and phone number you registered with.</p>
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="label block mb-2">Full name</label>
                <input
                  className="field"
                  required
                  placeholder="As registered by the administrator"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="label block mb-2">Phone number</label>
                <input
                  className="field"
                  required
                  type="tel"
                  placeholder="e.g. 0244123456 or +233244123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Find my record
              </button>
            </form>
          </div>
        )}

        {/* ══ STEP 2: Confirm identity ══════════════════════════════════════ */}
        {step === "confirm" && lookupResult && (
          <div className="panel p-8">
            <div className="label text-xs mb-1">Step 2 of 4</div>
            <h1 className="font-display text-3xl font-black mb-2">Is this you?</h1>
            <p className="text-sm text-fg-dim mb-6">We found a matching record. Confirm this is you before we send your code.</p>

            {lookupResult.hasVoted ? (
              <div className="border border-warn/40 bg-warn/5 p-5 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-warn" />
                  <span className="label text-xs text-warn">Already voted</span>
                </div>
                <p className="text-sm text-warn">This voter has already cast their ballot in this election.</p>
              </div>
            ) : (
              <div className="border border-accent/30 bg-accent/5 p-5 mb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="label text-xs">Name</span>
                  <span className="font-semibold">{lookupResult.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="label text-xs">Phone</span>
                  <span className="font-mono text-accent">{lookupResult.maskedPhone}</span>
                </div>
              </div>
            )}

            {!lookupResult.hasVoted && (
              <button onClick={handleSendOtp} disabled={busy} className="btn-primary w-full">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                Yes, send me a code
              </button>
            )}
            <button onClick={reset} className="btn w-full mt-3">
              <RotateCcw size={14} /> That's not me — try again
            </button>
          </div>
        )}

        {/* ══ STEP 3: OTP entry ════════════════════════════════════════════ */}
        {step === "otp" && (
          <div className="panel p-8">
            <div className="label text-xs mb-1">Step 3 of 4</div>
            <h1 className="font-display text-3xl font-black mb-2">Enter your code</h1>
            <p className="text-sm text-fg-dim mb-1">
              A 6-digit code was sent to <span className="text-accent font-mono">{lookupResult?.maskedPhone}</span>.
            </p>
            {otpExpiry && (
              <p className="text-xs text-fg-mute mb-6">
                Valid until {new Date(otpExpiry).toLocaleTimeString()}.
              </p>
            )}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label block mb-2">Verification code</label>
                <input
                  className="field text-center tracking-[0.4em] text-2xl font-black"
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Verify code
              </button>
            </form>
            {resendCount < 2 && (
              <button
                onClick={handleSendOtp}
                disabled={busy}
                className="btn w-full mt-3"
              >
                <RotateCcw size={14} /> Resend code
              </button>
            )}
            <button onClick={reset} className="btn w-full mt-2 text-fg-mute border-line-dim">
              Start over
            </button>
          </div>
        )}

        {/* ══ STEP 4: Ballot ═══════════════════════════════════════════════ */}
        {step === "ballot" && ballot && (
          <div>
            <div className="panel p-6 mb-6">
              <div className="label text-xs mb-1">Step 4 of 4 · Casting ballot for</div>
              <h1 className="font-display text-2xl font-black">{ballot.election.title}</h1>
              {ballot.election.description && (
                <p className="text-sm text-fg-dim mt-1">{ballot.election.description}</p>
              )}
              <div className="mt-4">
                <div className="flex justify-between label text-xs mb-1">
                  <span>Ballot completion</span>
                  <span className={complete ? "text-accent" : "text-fg-dim"}>
                    {selectedCount} / {positions.length} positions
                  </span>
                </div>
                <div className="w-full bg-line h-2">
                  <div
                    className="h-2 transition-all duration-500"
                    style={{
                      width: `${positions.length > 0 ? (selectedCount / positions.length) * 100 : 0}%`,
                      background: complete ? "#B4FF39" : "#3AF0FF",
                    }}
                  />
                </div>
              </div>
            </div>

            {err && (
              <div className="mb-4 border border-danger/50 bg-danger/5 p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{err}</p>
              </div>
            )}

            <div className="space-y-5">
              {positions.map((pos, idx) => {
                const list     = candidates.filter((c) => c.position_id === pos.id);
                const selected = selections[pos.id];
                return (
                  <div
                    key={pos.id}
                    className={`panel overflow-hidden transition-all ${selected ? "border-accent/50" : ""}`}
                  >
                    <div className="px-5 py-4 border-b border-line bg-bg-2 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="label text-xs text-fg-mute">#{idx + 1}</span>
                          <span className="font-display text-lg font-bold">{pos.name}</span>
                        </div>
                        {pos.description && <div className="text-xs text-fg-dim mt-0.5">{pos.description}</div>}
                      </div>
                      {selected
                        ? <CheckCircle2 size={18} className="text-accent flex-shrink-0" />
                        : <span className="label text-xs text-warn">Select one</span>
                      }
                    </div>
                    <div className="p-4 grid gap-3 sm:grid-cols-2">
                      {list.length === 0 && (
                        <p className="text-sm text-fg-dim col-span-2 text-center py-4">No candidates for this position.</p>
                      )}
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
                              <div className={`w-5 h-5 border flex items-center justify-center flex-shrink-0 transition-all ${
                                active ? "border-accent bg-accent" : "border-line"
                              }`}>
                                {active && <Check size={12} className="text-bg" />}
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

            <div className="mt-8 flex gap-3">
              <button
                className="btn-primary flex-1"
                onClick={handleCastBallot}
                disabled={busy || !complete}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {busy ? "Submitting…" : "Seal & Submit Ballot"}
              </button>
            </div>
            {!complete && positions.length > 0 && (
              <p className="mt-3 text-xs text-fg-dim text-center">
                Select a candidate for every position ({positions.length - selectedCount} remaining).
              </p>
            )}
          </div>
        )}

        {/* ══ STEP 5: Receipt ══════════════════════════════════════════════ */}
        {step === "receipt" && receipt && (
          <div className="space-y-6">
            <div className="panel p-8 text-center">
              <div className="w-20 h-20 border border-accent bg-accent/5 flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-accent" />
              </div>
              <h1 className="mt-6 font-display text-3xl font-black">Vote recorded!</h1>
              <p className="mt-2 text-fg-dim text-sm">
                Your ballot has been sealed and counted for <span className="text-fg font-semibold">{receipt.electionTitle}</span>.
              </p>
              <p className="mt-1 text-xs text-fg-mute">
                {new Date(receipt.castAt).toLocaleString()}
              </p>
            </div>

            <div className="panel p-6">
              <div className="label text-xs mb-3">Your vote receipt</div>
              <div className="flex items-stretch gap-2 mb-4">
                <div className="flex-1 font-mono text-3xl font-black tracking-[0.25em] border border-accent p-5 text-center text-accent bg-accent/5">
                  {receipt.receiptCode}
                </div>
                <button className="btn px-4" onClick={copyReceipt} aria-label="Copy receipt code">
                  {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="border border-line-dim bg-bg-2 p-4 text-sm text-fg-dim leading-relaxed">
                <p className="font-semibold text-fg mb-1">Keep this code.</p>
                <p>After the election closes, you can use it on this page to confirm your vote was counted. This receipt does <span className="text-fg font-medium">not</span> show who you voted for — your ballot is secret.</p>
              </div>
              <p className="mt-3 text-xs text-fg-mute">A copy has also been sent to your phone via SMS.</p>
            </div>

            <Link to="/" className="btn w-full justify-center">Back to home</Link>
          </div>
        )}

        {/* ── Receipt verification panel (always visible at bottom) ─────── */}
        {step === "lookup" && (
          <div className="mt-10 panel p-6">
            <div className="label text-xs mb-3">Verify a previous vote</div>
            <p className="text-sm text-fg-dim mb-4">Already voted? Enter your receipt code to confirm it was counted.</p>
            <form onSubmit={handleVerifyReceipt} className="flex gap-2">
              <input
                className="field flex-1 uppercase tracking-widest"
                placeholder="Receipt code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <button type="submit" disabled={busy || !verifyCode} className="btn">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </form>
            {verifyResult && (
              <div className={`mt-3 border p-3 text-sm flex items-center gap-2 ${
                verifyResult.found ? "border-ok/40 bg-ok/5 text-ok" : "border-danger/40 bg-danger/5 text-danger"
              }`}>
                {verifyResult.found
                  ? <><CheckCircle2 size={14} /> Vote confirmed — cast at {new Date(verifyResult.castAt!).toLocaleString()}</>
                  : <><AlertTriangle size={14} /> Receipt code not found for this election.</>
                }
              </div>
            )}
          </div>
        )}

      </main>
      <SiteFooter />
    </div>
  );
}
