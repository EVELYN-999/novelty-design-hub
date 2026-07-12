import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Copy, ShieldCheck, AlertCircle, KeyRound, Vote as VoteIcon } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { accentFor, initialsOf } from "@/lib/election-data";
import { requestOtp, verifyOtp, castBallot, getBallot } from "@/lib/election.functions";

export const Route = createFileRoute("/vote")({
  component: VotePage,
  head: () => ({
    meta: [
      { title: "Cast Ballot — ELECTION/NODE" },
      { name: "description", content: "Blind-signature ballot casting with public hash-chain receipt." },
    ],
  }),
});

type Step = "id" | "otp" | "ballot" | "confirm" | "cast" | "receipt";
const STEPS: { key: Step; label: string }[] = [
  { key: "id", label: "Identify" },
  { key: "otp", label: "Verify" },
  { key: "ballot", label: "Mark" },
  { key: "confirm", label: "Review" },
  { key: "cast", label: "Cast" },
  { key: "receipt", label: "Receipt" },
];

function VotePage() {
  const [step, setStep] = useState<Step>("id");
  const [voterId, setVoterId] = useState("");
  const [phoneMask, setPhoneMask] = useState("");
  const [devCode, setDevCode] = useState("");
  const [otp, setOtp] = useState("");
  const [castToken, setCastToken] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<{
    receiptHash: string; entryHash: string; prevHash: string;
    tokenFingerprint: string; index: number; timestamp: string;
  } | null>(null);

  const getBallotFn = useServerFn(getBallot);
  const reqOtpFn = useServerFn(requestOtp);
  const verifyFn = useServerFn(verifyOtp);
  const castFn = useServerFn(castBallot);

  const ballot = useQuery({ queryKey: ["ballot"], queryFn: () => getBallotFn(), staleTime: 30_000 });
  const positions = ballot.data?.positions ?? [];
  const candidates = ballot.data?.candidates ?? [];

  const reqOtpM = useMutation({
    mutationFn: (vid: string) => reqOtpFn({ data: { voterId: vid } }),
    onSuccess: (r) => { setPhoneMask(r.phoneMask); setDevCode(r.devCode); setStep("otp"); },
  });
  const verifyM = useMutation({
    mutationFn: (args: { voterId: string; code: string }) => verifyFn({ data: args }),
    onSuccess: (r) => { setCastToken(r.castToken); setStep("ballot"); },
  });
  const castM = useMutation({
    mutationFn: (args: { castToken: string; selections: Record<string, string> }) => castFn({ data: args }),
    onSuccess: (r) => { setReceipt(r); setStep("receipt"); },
  });

  const allSelected = positions.length > 0 && positions.every((p) => selections[p.id]);
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function doCast() {
    setStep("cast");
    setTimeout(() => castM.mutate({ castToken, selections }), 400);
  }

  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1200px] px-5 lg:px-10">
        {/* Header */}
        <div className="py-10 border-b border-line">
          <div className="label-on">§ Polling node</div>
          <h2 className="mt-3 font-display font-black text-4xl md:text-6xl tracking-[-0.03em]">
            Cast a <span className="text-accent">sealed</span> ballot.
          </h2>
          <p className="mt-3 text-fg-dim max-w-2xl">
            Six steps. The server signs your token but never sees your selections. Nothing is stored until you confirm.
          </p>
        </div>

        {/* Stepper */}
        <div className="border-b border-line overflow-x-auto">
          <ol className="flex min-w-max">
            {STEPS.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-3 px-5 py-4 border-r border-line ${
                    active ? "bg-accent text-bg" : done ? "text-accent" : "text-fg-mute"
                  }`}>
                    <span className="mono font-bold text-sm">
                      {done ? <Check size={16} /> : String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="label" style={active ? { color: "var(--bg)" } : done ? { color: "var(--accent)" } : undefined}>
                      {s.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <section className="py-10 pb-24">
          {step === "id" && (
            <Frame n="01" title="Identify.">
              <p className="text-fg-dim max-w-2xl">
                Enter the voter identifier issued by your assembly. A one-time code will be dispatched.
              </p>
              <div className="mt-6 panel p-4 max-w-lg">
                <div className="label">Demo register</div>
                <p className="text-sm text-fg-dim mt-1">
                  Twenty test voters <span className="mono text-fg">HS-2024-0001</span> … <span className="mono text-fg">HS-2024-0020</span>. Each may vote once.
                </p>
              </div>
              <div className="mt-8 max-w-lg">
                <label htmlFor="vid" className="label">Voter ID</label>
                <input id="vid" autoFocus value={voterId}
                  onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                  placeholder="HS-2024-0001"
                  className="field-lg mt-2" />
                <ErrLine err={reqOtpM.error} />
                <button
                  onClick={() => reqOtpM.mutate(voterId.trim())}
                  disabled={!voterId.trim() || reqOtpM.isPending}
                  className="btn-primary hover:btn-primary-hover mt-6 disabled:opacity-40 disabled:cursor-not-allowed w-full">
                  {reqOtpM.isPending ? "Issuing…" : "Issue one-time code"} <ArrowRight size={16} />
                </button>
              </div>
            </Frame>
          )}

          {step === "otp" && (
            <Frame n="02" title="Verify.">
              <p className="text-fg-dim max-w-2xl">
                Six-digit code sent to <span className="text-fg mono">{phoneMask}</span>. Expires in 5 minutes.
              </p>
              {devCode && (
                <div className="mt-5 panel-accent p-4 max-w-lg flex gap-3">
                  <KeyRound size={20} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="label-on">Demo mode · SMS not wired</div>
                    <p className="mt-1">Code: <span className="mono text-2xl font-bold text-accent">{devCode}</span></p>
                  </div>
                </div>
              )}
              <div className="mt-8 max-w-lg">
                <label htmlFor="otp" className="label">One-time code</label>
                <input id="otp" autoFocus inputMode="numeric" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="mt-2 w-full bg-bg-2 border border-line px-4 py-5 mono text-4xl text-center tracking-[0.4em] focus:outline-none focus:border-accent" />
                <ErrLine err={verifyM.error} />
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setStep("id")} className="btn hover:border-fg"><ArrowLeft size={16} /> Change ID</button>
                  <button
                    onClick={() => verifyM.mutate({ voterId, code: otp })}
                    disabled={otp.length !== 6 || verifyM.isPending}
                    className="btn-primary hover:btn-primary-hover flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    {verifyM.isPending ? "Verifying…" : "Verify & obtain token"} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </Frame>
          )}

          {step === "ballot" && (
            <Frame n="03" title="Mark ballot.">
              <p className="text-fg-dim max-w-2xl">
                Exactly one selection per position. Selections stay on this device until you confirm.
              </p>
              <div className="mt-10 space-y-12">
                {positions.map((pos, i) => {
                  const cands = candidates.filter((c) => c.position_id === pos.id);
                  const marked = !!selections[pos.id];
                  return (
                    <fieldset key={pos.id} className="border-t border-line pt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
                        <div>
                          <div className="label">Position {String(i + 1).padStart(2, "0")} / {positions.length}</div>
                          <legend className="mt-1 font-display text-2xl md:text-3xl font-black">{pos.name}</legend>
                          <p className="text-fg-dim text-sm mt-1">{pos.description}</p>
                        </div>
                        <span className={`px-3 py-1.5 label border ${marked ? "border-accent text-accent" : "border-danger text-danger"}`}>
                          {marked ? "◼ Marked" : "◇ Required"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {cands.map((c) => {
                          const active = selections[pos.id] === c.id;
                          return (
                            <label key={c.id}
                              className={`flex gap-3 p-4 cursor-pointer border transition-all ${
                                active ? "border-accent bg-accent/10" : "border-line hover:border-fg-dim bg-panel"
                              }`}>
                              <input type="radio" name={pos.id} className="sr-only" checked={active}
                                onChange={() => setSelections((s) => ({ ...s, [pos.id]: c.id }))} />
                              <div className="h-12 w-12 shrink-0 border border-line flex items-center justify-center mono font-bold text-bg"
                                style={{ background: accentFor(c.id) }}>
                                {initialsOf(c.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm">{c.name}</div>
                                <p className="text-xs text-fg-dim leading-snug mt-1">{c.bio}</p>
                              </div>
                              <div className={`h-5 w-5 shrink-0 border ${active ? "border-accent bg-accent" : "border-line"}`} aria-hidden>
                                {active && <Check size={12} className="text-bg m-0.5" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                <div className="text-sm">
                  <span className="mono text-3xl font-bold text-accent">{Object.keys(selections).length}</span>
                  <span className="text-fg-dim ml-2">/ {positions.length} positions marked</span>
                </div>
                <button onClick={() => setStep("confirm")} disabled={!allSelected}
                  className="btn-primary hover:btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">
                  Review before casting <ArrowRight size={16} />
                </button>
              </div>
            </Frame>
          )}

          {step === "confirm" && (
            <Frame n="04" title="Review. Confirm.">
              <p className="text-fg-dim max-w-2xl">
                Casting is final. The ballot enters the public ledger as an anonymous, hash-chained entry.
              </p>
              <div className="mt-8 panel p-6 md:p-8 max-w-2xl">
                <div className="label">Ballot to be cast</div>
                <hr className="my-4 border-line" />
                <dl className="divide-y divide-line">
                  {positions.map((p) => {
                    const c = candidates.find((c) => c.id === selections[p.id])!;
                    return (
                      <div key={p.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-4">
                        <dt className="label">{p.name}</dt>
                        <dd className="sm:col-span-2 font-display text-xl font-black">{c?.name}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
              <ErrLine err={castM.error} />
              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-2xl">
                <button onClick={() => setStep("ballot")} className="btn hover:border-fg">
                  <ArrowLeft size={16} /> Amend
                </button>
                <button onClick={doCast} disabled={castM.isPending}
                  className="btn-primary hover:btn-primary-hover flex-1 disabled:opacity-60">
                  <VoteIcon size={18} /> {castM.isPending ? "Casting…" : "Cast ballot · final"} <ArrowRight size={16} />
                </button>
              </div>
            </Frame>
          )}

          {step === "cast" && (
            <Frame n="05" title="Signing. Sealing. Appending.">
              <div className="mt-8 max-w-2xl scanline">
                <div className="scanline-after" />
                <div className="panel p-6 mono text-sm space-y-3">
                  <Press delay={0}>→ Consuming single-use cast token…</Press>
                  <Press delay={0.35}>→ Fetching previous ledger hash…</Press>
                  <Press delay={0.7}>→ Computing entry_hash = SHA-256(prev ‖ selections ‖ nonce)…</Press>
                  <Press delay={1.05}>→ Appending to public ledger…</Press>
                  <Press delay={1.4}>→ Issuing receipt…</Press>
                </div>
              </div>
            </Frame>
          )}

          {step === "receipt" && receipt && (
            <Frame n="06" title="Receipt.">
              <p className="text-fg-dim max-w-2xl">
                Only you can meaningfully use this receipt. It proves your ballot to <em className="text-fg">you</em> — not to a third party.
              </p>
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className="mt-8 max-w-3xl panel-accent">
                <div className="p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="label-on">Receipt of casting</div>
                      <h4 className="mt-2 font-display text-3xl font-black">◼ Ballot recorded.</h4>
                      <div className="label mt-2">Entry #{String(receipt.index).padStart(4, "0")}</div>
                    </div>
                    <div className="border border-accent px-4 py-2 text-accent mono text-xs">
                      {new Date(receipt.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <hr className="my-6 border-line" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Receipt hash" value={receipt.receiptHash} accent />
                    <Field label="Entry hash" value={receipt.entryHash} />
                    <Field label="Prev. ledger hash" value={receipt.prevHash} />
                    <Field label="Token fingerprint" value={receipt.tokenFingerprint} />
                  </div>
                  <hr className="my-6 border-line" />
                  <div className="label mb-3">Selections encoded within</div>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {positions.map((p) => {
                      const c = candidates.find((c) => c.id === selections[p.id])!;
                      return (
                        <li key={p.id}>
                          <div className="label">{p.name}</div>
                          <div className="font-bold">{c?.name}</div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button onClick={() => navigator.clipboard?.writeText(receipt.receiptHash)} className="btn hover:border-accent hover:text-accent">
                      <Copy size={14} /> Copy receipt hash
                    </button>
                    <Link to="/verify" search={{ hash: receipt.receiptHash }} className="btn-primary hover:btn-primary-hover">
                      <ShieldCheck size={16} /> Verify against ledger
                    </Link>
                    <Link to="/" className="btn hover:border-fg">Return</Link>
                  </div>
                </div>
              </motion.div>
            </Frame>
          )}
        </section>
      </main>
      <Colophon />
    </div>
  );
}

function Frame({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6">
        <span className="mono text-4xl md:text-5xl font-black text-accent">{n}</span>
        <h3 className="font-display text-2xl md:text-3xl font-black">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={accent ? "label-on" : "label"}>{label}</div>
      <p className={`mono text-xs break-all mt-1 ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

function Press({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className="flex items-center gap-3">
      <span className="h-2 w-2 bg-accent" />
      <span>{children}</span>
    </motion.div>
  );
}

function ErrLine({ err }: { err: unknown }) {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    <div className="mt-4 flex gap-2 items-start text-danger text-sm border border-danger p-3">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
