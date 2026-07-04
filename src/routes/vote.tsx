import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES, candidateAvatar } from "@/lib/election-data";

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

function VotePage() {
  const [step, setStep] = useState<Step>("id");
  const [voterId, setVoterId] = useState("");
  const [phoneMask, setPhoneMask] = useState("");
  const [otp, setOtp] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const allSelected = POSITIONS.every(p => selections[p.id]);

  function requestOtp() {
    if (!voterId.trim()) return;
    // pseudo mask
    setPhoneMask("+44 ••• ••• ••42");
    setStep("otp");
  }
  function verifyOtp() {
    if (otp.length !== 6) return;
    setStep("ballot");
  }
  function issueTokenAndCast() {
    // pseudo blind-signed token + receipt
    const rand = () => Math.floor(Math.random() * 16).toString(16);
    const hex = (n: number) => Array.from({ length: n }, rand).join("");
    setToken("bsig_" + hex(28));
    setReceipt("0x" + hex(40));
    setStep("cast");
    setTimeout(() => setStep("receipt"), 1400);
  }

  return (
    <div className="min-h-screen">
      <Masthead compact />

      <main className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <PageHeading step={step} />

        <div className="grid grid-cols-12 gap-8 pb-16">
          {/* progress rail */}
          <aside className="col-span-12 md:col-span-3">
            <ProgressRail step={step} />

            <div className="mt-8 border-2 border-ink/40 p-5">
              <div className="marginalia">Ballot of Record</div>
              <p className="hash-mono mt-2">{ELECTION.ballot_hash}</p>
              <div className="marginalia mt-4">Locked</div>
              <p className="text-sm">{ELECTION.ballot_locked_at}</p>
            </div>
          </aside>

          <section className="col-span-12 md:col-span-9">
            {step === "id" && (
              <StepShell number="01" title="Present your voter identification.">
                <p className="text-ink-soft text-sm max-w-prose leading-relaxed">
                  Enter the voter identifier printed on your Society card. We will
                  send a one-time code to the telephone number on file — never to
                  a number typed here. If the number is out of date, contact the
                  registrar.
                </p>
                <div className="mt-8 max-w-md">
                  <label className="marginalia">Voter ID</label>
                  <input
                    autoFocus
                    value={voterId}
                    onChange={e => setVoterId(e.target.value.toUpperCase())}
                    placeholder="HS-2024-••••"
                    className="mt-2 w-full border-2 border-ink bg-transparent px-4 py-4 font-mono text-xl tracking-widest focus:outline-none focus:border-stamp"
                  />
                  <button
                    onClick={requestOtp}
                    disabled={!voterId.trim()}
                    className="smallcaps mt-4 w-full border-2 border-ink bg-ink text-paper px-6 py-4 text-xs hover:bg-stamp hover:border-stamp disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Request one-time code →
                  </button>
                  <p className="marginalia mt-4">Rate-limited to 3 requests per 15 minutes.</p>
                </div>
              </StepShell>
            )}

            {step === "otp" && (
              <StepShell number="02" title="Enter the one-time code.">
                <p className="text-ink-soft text-sm max-w-prose leading-relaxed">
                  A six-digit code has been dispatched to <strong>{phoneMask}</strong>.
                  It expires in five minutes and may be used exactly once.
                </p>
                <div className="mt-8 max-w-md">
                  <label className="marginalia">One-time code</label>
                  <input
                    autoFocus
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="mt-2 w-full border-2 border-ink bg-transparent px-4 py-4 font-mono text-3xl text-center tracking-[0.5em] focus:outline-none focus:border-stamp"
                  />
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setStep("id")}
                      className="smallcaps flex-1 border-2 border-ink/30 px-6 py-4 text-xs hover:border-ink transition-colors"
                    >
                      ← Change ID
                    </button>
                    <button
                      onClick={verifyOtp}
                      disabled={otp.length !== 6}
                      className="smallcaps flex-[2] border-2 border-ink bg-ink text-paper px-6 py-4 text-xs hover:bg-stamp hover:border-stamp disabled:opacity-40 transition-colors"
                    >
                      Verify & proceed →
                    </button>
                  </div>
                  <p className="marginalia mt-4">Try 000000 for demonstration.</p>
                </div>
              </StepShell>
            )}

            {step === "ballot" && (
              <StepShell number="03" title="Mark the ballot.">
                <p className="text-ink-soft text-sm max-w-prose leading-relaxed">
                  You must record exactly one selection for every position. There
                  is no abstention. Your selections do not leave this device until
                  you confirm.
                </p>

                <div className="mt-8 space-y-10">
                  {POSITIONS.map((pos, i) => {
                    const cands = CANDIDATES.filter(c => c.position_id === pos.id)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    return (
                      <fieldset key={pos.id} className="border-t-2 border-ink pt-6">
                        <div className="flex items-baseline justify-between mb-5">
                          <div>
                            <div className="marginalia">Position {String(i + 1).padStart(2, "0")}</div>
                            <legend className="font-display text-3xl italic mt-1">{pos.name}</legend>
                          </div>
                          {selections[pos.id] ? (
                            <div className="stamp">Marked</div>
                          ) : (
                            <div className="marginalia text-stamp">Required</div>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {cands.map(c => {
                            const active = selections[pos.id] === c.id;
                            return (
                              <label
                                key={c.id}
                                className={`flex gap-3 border-2 p-4 cursor-pointer transition-all ${
                                  active
                                    ? "border-stamp bg-stamp/5"
                                    : "border-ink/25 hover:border-ink"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={pos.id}
                                  className="sr-only"
                                  checked={active}
                                  onChange={() => setSelections(s => ({ ...s, [pos.id]: c.id }))}
                                />
                                <div
                                  className="h-14 w-14 shrink-0 border-2 border-ink flex items-center justify-center font-display text-lg text-paper"
                                  style={{ background: candidateAvatar(c.photo_hue) }}
                                >
                                  {c.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <div className="flex-1">
                                  <div className="font-display text-lg leading-tight">{c.name}</div>
                                  <p className="text-xs text-ink-soft leading-snug mt-1">{c.bio}</p>
                                </div>
                                <div
                                  className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                                    active ? "border-stamp bg-stamp" : "border-ink/40"
                                  }`}
                                  aria-hidden
                                />
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>

                <div className="mt-10 flex items-center justify-between border-t-2 border-ink pt-6">
                  <div className="marginalia">
                    {Object.keys(selections).length} of {POSITIONS.length} positions marked
                  </div>
                  <button
                    onClick={() => setStep("confirm")}
                    disabled={!allSelected}
                    className="smallcaps border-2 border-ink bg-ink text-paper px-8 py-4 text-xs hover:bg-stamp hover:border-stamp disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Review before casting →
                  </button>
                </div>
              </StepShell>
            )}

            {step === "confirm" && (
              <StepShell number="04" title="Review, then cast.">
                <p className="text-ink-soft text-sm max-w-prose leading-relaxed">
                  Casting is final. Once submitted, the ballot enters the public
                  ledger as an anonymous entry and cannot be recalled.
                </p>
                <div className="mt-8 border-2 border-ink p-6 bg-card">
                  <div className="marginalia">Ballot for casting</div>
                  <div className="rule-hair my-3" />
                  <dl className="divide-y divide-ink/20">
                    {POSITIONS.map(p => {
                      const c = CANDIDATES.find(c => c.id === selections[p.id])!;
                      return (
                        <div key={p.id} className="grid grid-cols-12 gap-4 py-4">
                          <dt className="col-span-4 smallcaps text-xs text-ink-soft">{p.name}</dt>
                          <dd className="col-span-8 font-display text-xl">{c.name}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep("ballot")}
                    className="smallcaps border-2 border-ink/30 px-6 py-4 text-xs hover:border-ink transition-colors"
                  >
                    ← Amend selections
                  </button>
                  <button
                    onClick={issueTokenAndCast}
                    className="smallcaps flex-1 border-2 border-stamp bg-stamp text-paper px-6 py-4 text-xs hover:bg-ink hover:border-ink transition-colors"
                  >
                    Cast the ballot · Final →
                  </button>
                </div>
              </StepShell>
            )}

            {step === "cast" && (
              <StepShell number="05" title="Signing, sealing, appending.">
                <div className="mt-8 space-y-4 max-w-lg font-mono text-sm">
                  <PressLine>Blinding token client-side</PressLine>
                  <PressLine>Requesting blind signature from returning officer</PressLine>
                  <PressLine>Unblinding · producing anonymous signed token</PressLine>
                  <PressLine>Submitting selections via anonymous channel</PressLine>
                  <PressLine>Appending to ledger · linking to previous hash</PressLine>
                </div>
              </StepShell>
            )}

            {step === "receipt" && (
              <StepShell number="06" title="Your receipt.">
                <p className="text-ink-soft text-sm max-w-prose leading-relaxed">
                  Save this receipt. It is the only artifact linking you to your
                  ballot — and only you can meaningfully use it. Presenting it to
                  another person proves nothing they can independently verify.
                </p>

                <div className="mt-8 max-w-2xl">
                  <div className="ticket p-8">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="marginalia">Receipt of Casting</div>
                        <h4 className="font-display text-3xl italic mt-1">Ballot recorded.</h4>
                        <p className="marginalia mt-2">The Herald Society · Annual Election MMXXVI</p>
                      </div>
                      <div className="stamp-block text-center">
                        <div className="font-display italic text-lg">Cast</div>
                        <div className="marginalia">07 Jul · 10:04</div>
                      </div>
                    </div>

                    <div className="rule-hair my-6" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReceiptField label="Receipt hash" value={receipt} mono />
                      <ReceiptField label="Anonymous token" value={token} mono />
                      <ReceiptField label="Prev. ledger hash" value={ELECTION.ballot_hash.slice(0, 22) + "…"} mono />
                      <ReceiptField label="Signing key" value={ELECTION.signing_key_fp} mono />
                    </div>

                    <div className="rule-hair my-6" />

                    <div className="marginalia">Selections encoded within</div>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-3">
                      {POSITIONS.map(p => {
                        const c = CANDIDATES.find(c => c.id === selections[p.id])!;
                        return (
                          <li key={p.id} className="text-sm">
                            <span className="text-ink-soft">{p.name}: </span>
                            <span className="font-display">{c.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => navigator.clipboard?.writeText(receipt)}
                      className="smallcaps border-2 border-ink px-6 py-3 text-xs hover:bg-ink hover:text-paper transition-colors"
                    >
                      Copy receipt hash
                    </button>
                    <Link
                      to="/verify"
                      search={{ hash: receipt }}
                      className="smallcaps border-2 border-ink px-6 py-3 text-xs hover:bg-ink hover:text-paper transition-colors"
                    >
                      Verify against ledger →
                    </Link>
                    <Link
                      to="/"
                      className="smallcaps border-2 border-ink/30 px-6 py-3 text-xs hover:border-ink transition-colors"
                    >
                      Return to front page
                    </Link>
                  </div>
                </div>
              </StepShell>
            )}
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}

function PageHeading({ step }: { step: Step }) {
  const titles: Record<Step, string> = {
    id: "Polling Room",
    otp: "Polling Room",
    ballot: "Polling Room",
    confirm: "Polling Room",
    cast: "Polling Room",
    receipt: "Receipt Desk",
  };
  return (
    <div className="py-8 grid grid-cols-12 gap-8 items-end border-b-2 border-ink">
      <div className="col-span-12 md:col-span-9">
        <div className="marginalia">Section · {titles[step]}</div>
        <h2 className="mt-2 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.95]">
          Cast a <em className="italic">private</em> ballot.
        </h2>
      </div>
      <div className="col-span-12 md:col-span-3 text-right marginalia">
        Doors close 14 Jul · 21:00 GMT
      </div>
    </div>
  );
}

function ProgressRail({ step }: { step: Step }) {
  const order: { key: Step; label: string }[] = [
    { key: "id", label: "Present ID" },
    { key: "otp", label: "One-time code" },
    { key: "ballot", label: "Mark ballot" },
    { key: "confirm", label: "Review" },
    { key: "cast", label: "Cast" },
    { key: "receipt", label: "Receipt" },
  ];
  const idx = order.findIndex(o => o.key === step);
  return (
    <ol className="relative pl-6">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-ink/25" />
      {order.map((o, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={o.key} className="relative pb-5">
            <span
              className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 ${
                done ? "bg-ink border-ink" : active ? "bg-stamp border-stamp" : "bg-paper border-ink/40"
              }`}
            />
            <div className={`marginalia ${active ? "text-stamp" : ""}`}>Step {String(i + 1).padStart(2, "0")}</div>
            <div className={`font-display text-lg leading-tight ${active ? "text-ink" : done ? "text-ink" : "text-ink-soft"}`}>
              {o.label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="pt-8">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-5xl text-stamp">{number}</span>
        <h3 className="font-display text-3xl leading-tight">{title}</h3>
      </div>
      <div className="rule-hair my-5" />
      {children}
    </div>
  );
}

function PressLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-block h-2 w-2 rounded-full bg-verify animate-pulse" />
      <span>{children}</span>
      <span className="ml-auto marginalia">ok</span>
    </div>
  );
}

function ReceiptField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="marginalia">{label}</div>
      <div className={mono ? "hash-mono mt-1" : "mt-1 text-sm"}>{value}</div>
    </div>
  );
}
