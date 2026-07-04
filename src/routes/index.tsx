import { createFileRoute, Link } from "@tanstack/react-router";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES, LEDGER, candidateAvatar } from "@/lib/election-data";

export const Route = createFileRoute("/")({
  component: FrontPage,
  head: () => ({
    meta: [
      { title: "The Ballot Gazette — Front Page" },
      { name: "description", content: "The Annual General Election of The Herald Society. Cast your ballot, inspect the public ledger, and independently verify the count." },
    ],
  }),
});

function FrontPage() {
  const chairCount = CANDIDATES.filter(c => c.position_id === "pos-chair").length;
  const totalCandidates = CANDIDATES.length;
  const castCount = LEDGER.length;
  const turnout = ((castCount / ELECTION.eligible_voters) * 100).toFixed(1);

  return (
    <div className="min-h-screen">
      <Masthead />

      <main className="mx-auto max-w-[1400px] px-6 lg:px-10">
        {/* HERO / LEAD ARTICLE */}
        <section className="grid grid-cols-12 gap-8 pt-10 pb-14">
          {/* left rail — dateline */}
          <aside className="col-span-12 md:col-span-2 md:border-r md:border-ink/25 md:pr-6">
            <div className="marginalia">Dateline</div>
            <p className="mt-2 font-display italic text-lg leading-tight">
              London, the seventh of July, MMXXVI
            </p>
            <div className="rule-hair my-4" />
            <div className="marginalia">Filed under</div>
            <p className="mt-2 text-sm">Civic Record</p>
            <p className="text-sm">Governance</p>
            <p className="text-sm">Cryptography</p>
          </aside>

          {/* main lead */}
          <article className="col-span-12 md:col-span-7">
            <div className="smallcaps text-xs text-stamp">Lead Article · No. 1</div>
            <h2 className="mt-3 font-display text-[clamp(2rem,5vw,4rem)] leading-[1.02] tracking-tight">
              A ballot no one can <em className="italic">read over your shoulder</em> —
              and a count anyone can verify.
            </h2>
            <p className="mt-6 text-lg leading-relaxed max-w-prose">
              Voting opens at nine o&rsquo;clock this morning for the Society&rsquo;s
              annual election. As of previous years, and by unanimous vote of the
              council, the poll is conducted under a blind-signature ballot with a
              publicly hash-chained ledger. In plain words: your vote is sealed
              before it is signed, and the tally is a sum that any member may
              recompute at their own kitchen table.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/vote"
                className="smallcaps inline-flex items-center gap-3 border-2 border-ink bg-ink text-paper px-6 py-3 text-xs hover:bg-stamp hover:border-stamp transition-colors"
              >
                Enter the polling room →
              </Link>
              <Link
                to="/ledger"
                className="smallcaps inline-flex items-center gap-3 border-2 border-ink px-6 py-3 text-xs hover:bg-ink hover:text-paper transition-colors"
              >
                Read the public ledger
              </Link>
            </div>

            {/* pull quote */}
            <blockquote className="mt-10 border-l-4 border-stamp pl-6 py-2 font-display italic text-2xl leading-snug">
              &ldquo;The secret ballot is not a courtesy. It is the mechanism by
              which a person may disagree with power and still catch the bus
              home.&rdquo;
              <footer className="mt-3 marginalia not-italic">— From the founding minutes, 1974</footer>
            </blockquote>
          </article>

          {/* right rail — the stamp block */}
          <aside className="col-span-12 md:col-span-3">
            <div className="border-2 border-ink p-5">
              <div className="marginalia">Notice of Record</div>
              <div className="rule-hair my-3" />
              <p className="text-sm leading-relaxed">
                The ballot has been <strong>locked</strong> and its hash
                published. No further changes to positions or candidates are
                permissible until the poll closes.
              </p>
              <div className="mt-4 space-y-1">
                <div className="marginalia">Ballot hash</div>
                <p className="hash-mono">{ELECTION.ballot_hash}</p>
              </div>
              <div className="mt-4 marginalia">Locked</div>
              <p className="text-sm">{ELECTION.ballot_locked_at}</p>
              <div className="mt-6 flex justify-center">
                <div className="stamp">
                  <span>✕</span> Sealed of Record
                </div>
              </div>
            </div>

            {/* live tally strip */}
            <div className="mt-5 border-2 border-ink/40 p-5">
              <div className="marginalia">As we go to press</div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <Stat n={castCount.toString()} l="Cast" />
                <Stat n={ELECTION.eligible_voters.toLocaleString()} l="Eligible" />
                <Stat n={`${turnout}%`} l="Turnout" />
              </div>
            </div>
          </aside>
        </section>

        <div className="rule-thick" />

        {/* SECTION II — PRINCIPLES */}
        <section className="py-14 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="marginalia">Section II</div>
            <h3 className="mt-2 font-display text-4xl leading-tight">
              Six principles, engraved.
            </h3>
            <div className="rule-hair my-4" />
            <p className="text-sm text-ink-soft leading-relaxed">
              Every decision in the system defers to these. Where a convenience
              would compromise them, the convenience is refused.
            </p>
          </div>

          <div className="col-span-12 md:col-span-9 grid sm:grid-cols-2 gap-x-8">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="py-6 border-b border-ink/20">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-4xl text-stamp">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h4 className="font-display text-xl">{p.title}</h4>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft pl-12">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="rule-double" />

        {/* SECTION III — THE CANDIDATES */}
        <section className="py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="marginalia">Section III</div>
              <h3 className="mt-2 font-display text-4xl leading-tight">
                Standing for office <em className="italic">this session</em>.
              </h3>
            </div>
            <div className="marginalia hidden md:block">
              {totalCandidates} candidates · {POSITIONS.length} positions · {chairCount} for the Chair
            </div>
          </div>

          <div className="rule-hair mb-8" />

          {POSITIONS.map((pos) => {
            const cands = CANDIDATES.filter(c => c.position_id === pos.id)
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={pos.id} className="mb-12">
                <div className="grid grid-cols-12 gap-6 mb-4">
                  <div className="col-span-12 md:col-span-3">
                    <div className="marginalia">Position</div>
                    <h4 className="font-display text-3xl italic">{pos.name}</h4>
                  </div>
                  <p className="col-span-12 md:col-span-9 text-lg leading-snug pt-4">
                    {pos.description}
                  </p>
                </div>
                <div className={`grid gap-4 sm:grid-cols-2 ${cands.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                  {cands.map(c => (
                    <div key={c.id} className="border border-ink/25 bg-card p-5 flex gap-4">
                      <div
                        className="h-20 w-20 shrink-0 border-2 border-ink flex items-center justify-center font-display text-2xl text-paper"
                        style={{ background: candidateAvatar(c.photo_hue) }}
                      >
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1">
                        <div className="marginalia">Candidate</div>
                        <div className="font-display text-xl leading-tight">{c.name}</div>
                        <p className="mt-2 text-sm text-ink-soft leading-snug">{c.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <div className="rule-thick" />

        {/* SECTION IV — HOW IT WORKS */}
        <section className="py-14 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <div className="marginalia">Section IV · A Diagram</div>
            <h3 className="mt-2 font-display text-4xl leading-tight">
              How your ballot travels.
            </h3>
            <p className="mt-4 text-sm text-ink-soft leading-relaxed">
              At the point marked <em>blind signature</em>, the system attests
              that a member is entitled to vote — without ever seeing which
              vote is being attested to. It is the mathematical equivalent of
              stamping a sealed envelope through carbon paper.
            </p>
          </div>
          <ol className="col-span-12 md:col-span-8 relative">
            {FLOW.map((s, i) => (
              <li key={s.title} className="grid grid-cols-12 gap-4 pb-8 relative">
                <div className="col-span-2 text-right">
                  <span className="font-display text-5xl text-stamp">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="col-span-10 border-l-2 border-ink pl-5 pb-2">
                  <h4 className="font-display text-xl">{s.title}</h4>
                  <p className="mt-1 text-sm text-ink-soft leading-relaxed">{s.body}</p>
                  {s.hash && <p className="mt-2 hash-mono">{s.hash}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="rule-double" />

        {/* CALL TO CAST */}
        <section className="py-16 text-center">
          <div className="marginalia">Adjournment</div>
          <h3 className="mt-3 font-display text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">
            You have one <em className="italic">ballot</em>.
            <br />Cast it well.
          </h3>
          <div className="mt-8">
            <Link
              to="/vote"
              className="smallcaps inline-flex items-center gap-4 border-2 border-ink bg-ink text-paper px-10 py-5 text-sm hover:bg-stamp hover:border-stamp transition-colors"
            >
              Enter the polling room →
            </Link>
          </div>
        </section>
      </main>

      <Colophon />
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none">{n}</div>
      <div className="marginalia mt-1">{l}</div>
    </div>
  );
}

const PRINCIPLES = [
  { title: "Identity, unlinked", body: "The register of who voted and the record of what was voted are kept apart. There is no code path that can rejoin them." },
  { title: "Tamper-evident", body: "Every disputable step leaves a public artifact: a hash, a signature, a published record. Trust is not required — it is verifiable." },
  { title: "One author, in the open", body: "The ballot is authored by the returning officer alone. Every draft edit is logged, and the final list is hash-published before voting opens." },
  { title: "No mid-election drift", body: "Positions, candidates and eligibility freeze the moment voting opens. There are no quiet edits after the polls turn on." },
  { title: "Publicly recountable", body: "The published record is sufficient for an outside party to recompute the result. If they cannot, we haven't published enough." },
  { title: "Coercion-resistant", body: "Your receipt proves your vote to you and to no-one else. A buyer can be told anything, and cannot check." },
];

const FLOW = [
  { title: "OTP delivered", body: "A one-time code is sent to the phone on file — never to a number offered at login. The code lives five minutes, then it dies.", hash: "otp_hash · sha256(salt || code)" },
  { title: "Eligibility check", body: "Your voter ID is looked up in the frozen eligibility snapshot for this election. The snapshot cannot change, even by us.", hash: "snapshot_id · 2026-annual-frozen" },
  { title: "Blind signature", body: "Your client generates a random token and blinds it. The server signs the blinded value. This is the only moment identity and token co-exist.", hash: "blind_sig · RSA-4096 · unlinkable" },
  { title: "Vote cast", body: "You submit the unblinded token with a selection for every position. The server checks the signature, checks for double-spend, and appends.", hash: "" },
  { title: "Appended to ledger", body: "Your ballot becomes the newest link in a hash chain. Every entry names the one before it; the chain cannot be silently rewritten.", hash: "entry_n.prev = entry_{n−1}.hash" },
  { title: "Receipt, in your hand", body: "You receive a private receipt. You may look it up later against the public ledger. No-one else can confirm what it says.", hash: "receipt · sha256(selections || token || nonce)" },
];
