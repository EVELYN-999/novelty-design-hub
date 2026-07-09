import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowLeft, Check, Copy, ShieldCheck, AlertCircle, KeyRound } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES, candidateAvatar } from "@/lib/election-data";
import { requestOtp, verifyOtp, castBallot } from "@/lib/election.functions";

export const Route = createFileRoute("/vote")({
  component: VotePage,
  head: () => ({
    meta: [
      { title: "Cast a Ballot — The Ballot Gazette" },
      { name: "description", content: "Verify eligibility with a one-time code, cast a private ballot, and receive a receipt you alone can use." },
    ],
  }),
});

type Step = "id" | "otp" | "ballot" | "confirm" | "cast" | "receipt";

const STEPS: { key: Step; label: string }[] = [
  { key: "id", label: "Voter ID" },
  { key: "otp", label: "One-time code" },
  { key: "ballot", label: "Mark ballot" },
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
    receiptHash: string;
    entryHash: string;
    prevHash: string;
    tokenFingerprint: string;
    index: number;
    timestamp: string;
  } | null>(null);

  const reqOtpFn = useServerFn(requestOtp);
  const verifyFn = useServerFn(verifyOtp);
  const castFn = useServerFn(castBallot);

  const reqOtpM = useMutation({
    mutationFn: (vid: string) => reqOtpFn({ data: { voterId: vid } }),
    onSuccess: (res) => {
      setPhoneMask(res.phoneMask);
      setDevCode(res.devCode);
      setStep("otp");
    },
  });
  const verifyM = useMutation({
    mutationFn: (args: { voterId: string; code: string }) => verifyFn({ data: args }),
    onSuccess: (res) => {
      setCastToken(res.castToken);
      setStep("ballot");
    },
  });
  const castM = useMutation({
    mutationFn: (args: { castToken: string; selections: Record<string, string> }) =>
      castFn({ data: args }),
    onSuccess: (res) => {
      setReceipt(res);
      setStep("receipt");
    },
  });

  const allSelected = POSITIONS.every((p) => selections[p.id]);
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function doCast() {
    setStep("cast");
    castM.mutate({ castToken, selections });
  }

  return (
    <div className="min-h-screen">
      <Masthead compact />

      <main className="mx-auto max-w-[1000px] px-5 lg:px-10">
        <div className="py-10 border-b-2 border-ink">
          <div className="marginalia">Polling Room</div>
          <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
            Cast a <em className="italic">private</em> ballot.
          </h2>
          <p className="mt-3 text-lg text-ink-soft max-w-2xl">
            Six short steps. Nothing on this page is stored until you confirm on the final step.
          </p>
        </div>

        <div className="py-6 overflow-x-auto">
          <ol className="flex items-center gap-2 min-w-max">
            {STEPS.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-3 px-4 py-2 border-2 ${
                      active
                        ? "border-stamp bg-stamp text-paper"
                        : done
                          ? "border-ink bg-ink text-paper"
                          : "border-ink/25 text-ink-soft"
                    }`}
                  >
                    <span className="font-mono text-sm font-semibold">
                      {done ? <Check size={16} /> : String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className="h-[2px] w-4 bg-ink/25" />}
                </li>
              );
            })}
          </ol>
        </div>

        <section className="py-8 pb-20">
          {step === "id" && (
            <StepShell number="01" title="Present your voter identification.">
              <p className="text-lg text-ink-soft leading-relaxed max-w-2xl">
                Enter the voter identifier printed on your Society card. A one-time code will be issued
                to the number on your record.
              </p>
              <div className="mt-6 border-2 border-ink/25 bg-card p-4 max-w-lg">
                <div className="marginalia">Demo register</div>
                <p className="text-sm text-ink-soft mt-1 leading-relaxed">
                  Twenty test voters are pre-registered as <span className="font-mono">HS-2024-0001</span> through
                  {" "}<span className="font-mono">HS-2024-0020</span>. Each may vote once.
                </p>
              </div>
              <div className="mt-6 max-w-lg">
                <label htmlFor="voter-id" className="block text-base font-semibold mb-2">Voter ID</label>
                <input
                  id="voter-id"
                  autoFocus
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                  placeholder="HS-2024-0001"
                  className="w-full border-2 border-ink bg-paper px-4 py-4 font-mono text-xl tracking-wider focus:outline-none focus:border-stamp"
                />
                <p className="marginalia mt-3">Rate-limited to 3 requests per 15 minutes.</p>
                <ErrorLine err={reqOtpM.error} />
                <button
                  onClick={() => reqOtpM.mutate(voterId.trim())}
                  disabled={!voterId.trim() || reqOtpM.isPending}
                  className="btn-primary hover:bg-stamp hover:border-stamp disabled:opacity-40 disabled:cursor-not-allowed mt-6 w-full"
                >
                  {reqOtpM.isPending ? "Issuing code…" : "Request one-time code"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </StepShell>
          )}

          {step === "otp" && (
            <StepShell number="02" title="Enter the one-time code.">
              <p className="text-lg text-ink-soft leading-relaxed max-w-2xl">
                A six-digit code has been dispatched to <strong className="text-ink">{phoneMask}</strong>.
                It expires in five minutes and may be used exactly once.
              </p>
              {devCode && (
                <div className="mt-5 border-2 border-stamp bg-stamp/5 p-4 max-w-lg flex gap-3">
                  <KeyRound size={20} className="text-stamp shrink-0 mt-0.5" />
                  <div>
                    <div className="marginalia text-stamp">Demo mode · SMS not wired</div>
                    <p className="mt-1 text-base">
                      Your code is <span className="font-mono font-bold text-xl">{devCode}</span>
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-6 max-w-lg">
                <label htmlFor="otp" className="block text-base font-semibold mb-2">One-time code</label>
                <input
                  id="otp"
                  autoFocus
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full border-2 border-ink bg-paper px-4 py-5 font-mono text-4xl text-center tracking-[0.4em] focus:outline-none focus:border-stamp"
                />
                <ErrorLine err={verifyM.error} />
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setStep("id")} className="btn-ghost hover:border-ink flex-1">
                    <ArrowLeft size={18} /> Change ID
                  </button>
                  <button
                    onClick={() => verifyM.mutate({ voterId, code: otp })}
                    disabled={otp.length !== 6 || verifyM.isPending}
                    className="btn-primary hover:bg-stamp hover:border-stamp disabled:opacity-40 disabled:cursor-not-allowed flex-[2]"
                  >
                    {verifyM.isPending ? "Verifying…" : "Verify & proceed"} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </StepShell>
          )}

          {step === "ballot" && (
            <StepShell number="03" title="Mark the ballot.">
              <p className="text-lg text-ink-soft leading-relaxed max-w-2xl">
                Record exactly one selection for every position. Your selections do not leave this device
                until you confirm.
              </p>

              <div className="mt-10 space-y-12">
                {POSITIONS.map((pos, i) => {
                  const cands = CANDIDATES.filter((c) => c.position_id === pos.id)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  const marked = !!selections[pos.id];
                  return (
                    <fieldset key={pos.id} className="border-t-2 border-ink pt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
                        <div>
                          <div className="marginalia">Position {String(i + 1).padStart(2, "0")} of {POSITIONS.length}</div>
                          <legend className="font-display text-2xl md:text-3xl italic mt-1">{pos.name}</legend>
                        </div>
                        <span
                          className={`px-3 py-1.5 text-sm font-semibold border-2 ${
                            marked ? "border-verify text-verify" : "border-stamp text-stamp"
                          }`}
                        >
                          {marked ? "✓ Marked" : "Required"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {cands.map((c) => {
                          const active = selections[pos.id] === c.id;
                          return (
                            <label
                              key={c.id}
                              className={`flex gap-4 border-2 p-4 cursor-pointer transition-all ${
                                active
                                  ? "border-stamp bg-stamp/10"
                                  : "border-ink/25 hover:border-ink bg-card"
                              }`}
                            >
                              <input
                                type="radio"
                                name={pos.id}
                                className="sr-only"
                                checked={active}
                                onChange={() => setSelections((s) => ({ ...s, [pos.id]: c.id }))}
                              />
                              <div
                                className="h-14 w-14 shrink-0 border-2 border-ink flex items-center justify-center font-display text-lg text-paper"
                                style={{ background: candidateAvatar(c.photo_hue) }}
                              >
                                {c.name.split(" ").map((n) => n[0]).join("")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-display text-lg leading-tight">{c.name}</div>
                                <p className="text-sm text-ink-soft leading-snug mt-1">{c.bio}</p>
                              </div>
                              <div
                                className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                  active ? "border-stamp bg-stamp" : "border-ink/40"
                                }`}
                                aria-hidden
                              >
                                {active && <Check size={14} className="text-paper" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-6">
                <div className="text-base">
                  <strong className="font-display text-2xl text-stamp">{Object.keys(selections).length}</strong>
                  <span className="text-ink-soft"> of {POSITIONS.length} positions marked</span>
                </div>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!allSelected}
                  className="btn-primary hover:bg-stamp hover:border-stamp disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review before casting <ArrowRight size={18} />
                </button>
              </div>
            </StepShell>
          )}

          {step === "confirm" && (
            <StepShell number="04" title="Review, then cast.">
              <p className="text-lg text-ink-soft leading-relaxed max-w-2xl">
                Casting is final. Once submitted, the ballot enters the public ledger as an anonymous entry
                and cannot be recalled.
              </p>
              <div className="mt-8 border-2 border-ink bg-card p-6 md:p-8 max-w-2xl">
                <div className="marginalia">Ballot for casting</div>
                <div className="rule-hair my-4" />
                <dl className="divide-y divide-ink/20">
                  {POSITIONS.map((p) => {
                    const c = CANDIDATES.find((c) => c.id === selections[p.id])!;
                    return (
                      <div key={p.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-4">
                        <dt className="smallcaps text-sm text-ink-soft">{p.name}</dt>
                        <dd className="sm:col-span-2 font-display text-xl">{c.name}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              <ErrorLine err={castM.error} />

              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-2xl">
                <button onClick={() => setStep("ballot")} className="btn-ghost hover:border-ink">
                  <ArrowLeft size={18} /> Amend selections
                </button>
                <button
                  onClick={doCast}
                  disabled={castM.isPending}
                  className="btn-primary hover:bg-ink hover:border-ink flex-1 bg-stamp border-stamp disabled:opacity-60"
                >
                  {castM.isPending ? "Casting…" : "Cast the ballot · Final"} <ArrowRight size={18} />
                </button>
              </div>
            </StepShell>
          )}

          {step === "cast" && (
            <StepShell number="05" title="Signing, sealing, appending.">
              <div className="mt-8 space-y-3 max-w-xl font-mono text-base">
                <PressLine>Consuming single-use cast token…</PressLine>
                <PressLine>Fetching previous ledger hash…</PressLine>
                <PressLine>Computing entry hash · SHA-256(prev ‖ selections ‖ nonce)…</PressLine>
                <PressLine>Appending to public ledger…</PressLine>
                <PressLine>Issuing receipt…</PressLine>
              </div>
            </StepShell>
          )}

          {step === "receipt" && receipt && (
            <StepShell number="06" title="Your receipt.">
              <p className="text-lg text-ink-soft leading-relaxed max-w-2xl">
                Save this receipt. It is the only artifact linking you to your ballot — and only you can
                meaningfully use it.
              </p>

              <div className="mt-8 max-w-3xl">
                <div className="ticket p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="marginalia">Receipt of Casting</div>
                      <h4 className="font-display text-2xl md:text-3xl italic mt-1">Ballot recorded.</h4>
                      <p className="marginalia mt-2">Entry #{String(receipt.index).padStart(3, "0")}</p>
                    </div>
                    <div className="stamp-block text-center">
                      <div className="font-display italic text-lg">Cast</div>
                      <div className="marginalia">{new Date(receipt.timestamp).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="rule-hair my-6" />

                  <div className="grid gap-5 sm:grid-cols-2">
                    <ReceiptField label="Receipt hash" value={receipt.receiptHash} />
                    <ReceiptField label="Entry hash" value={receipt.entryHash} />
                    <ReceiptField label="Prev. ledger hash" value={receipt.prevHash} />
                    <ReceiptField label="Token fingerprint" value={receipt.tokenFingerprint} />
                  </div>

                  <div className="rule-hair my-6" />

                  <div className="marginalia">Selections encoded within</div>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                    {POSITIONS.map((p) => {
                      const c = CANDIDATES.find((c) => c.id === selections[p.id])!;
                      return (
                        <li key={p.id} className="text-base">
                          <div className="text-ink-soft text-sm">{p.name}</div>
                          <div className="font-display text-lg">{c.name}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigator.clipboard?.writeText(receipt.receiptHash)}
                    className="btn-secondary hover:bg-ink hover:text-paper"
                  >
                    <Copy size={18} /> Copy receipt hash
                  </button>
                  <Link
                    to="/verify"
                    search={{ hash: receipt.receiptHash }}
                    className="btn-primary hover:bg-stamp hover:border-stamp"
                  >
                    <ShieldCheck size={18} /> Verify against ledger
                  </Link>
                  <Link to="/" className="btn-ghost hover:border-ink">
                    Return to front page
                  </Link>
                </div>
              </div>
            </StepShell>
          )}
        </section>
      </main>
      <Colophon />
    </div>
  );
}

function StepShell({
  number, title, children,
}: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-4">
        <span className="font-display text-4xl md:text-5xl text-stamp">{number}</span>
        <h3 className="font-display text-2xl md:text-3xl">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="marginalia">{label}</div>
      <p className="font-mono text-sm break-all mt-1">{value}</p>
    </div>
  );
}

function PressLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2 w-2 bg-stamp animate-pulse" />
      <span>{children}</span>
    </div>
  );
}

function ErrorLine({ err }: { err: unknown }) {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    <div className="mt-4 flex gap-2 items-start text-stamp text-sm">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// Silence unused-import warning if ELECTION is not read in this file.
void ELECTION;
