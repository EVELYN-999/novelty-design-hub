import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShieldCheck, FileText, Vote, ScrollText } from "lucide-react";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES, candidateAvatar } from "@/lib/election-data";
import { getStats } from "@/lib/election.functions";

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
  const getStatsFn = useServerFn(getStats);
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => getStatsFn(),
    refetchInterval: 10000,
  });
  const castCount = stats.data?.castCount ?? 0;
  const eligible = stats.data?.eligible ?? ELECTION.eligible_voters;
  const turnout = eligible > 0 ? ((castCount / eligible) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen">
      <Masthead />

      <main className="mx-auto max-w-[1200px] px-5 lg:px-10">
        {/* HERO */}
        <section className="pt-14 pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="smallcaps text-sm text-stamp">Lead Article · Annual Election MMXXVI</div>
            <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.05]">
              A ballot no one can <em className="italic">read over your shoulder</em> — and a count anyone can verify.
            </h2>
            <p className="mt-7 text-lg leading-relaxed text-ink-soft">
              Voting opens today for the Society&rsquo;s annual election. The poll is conducted under a
              blind-signature ballot with a publicly hash-chained ledger — your vote is sealed before it
              is signed, and the tally is a sum any member may recompute at their own kitchen table.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/vote" className="btn-primary hover:bg-stamp hover:border-stamp">
                <Vote size={20} />
                Cast your ballot
                <ArrowRight size={18} />
              </Link>
              <Link to="/ledger" className="btn-secondary hover:bg-ink hover:text-paper">
                <ScrollText size={20} />
                Read the public ledger
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 border-y-2 border-ink py-8">
            <Stat n={castCount.toString()} l="Ballots cast" />
            <Stat n={eligible.toLocaleString()} l="Eligible voters" />
            <Stat n={`${turnout}%`} l="Turnout" />
            <Stat n={POSITIONS.length.toString()} l="Positions" />
          </div>
        </section>

        {/* WHAT YOU CAN DO — clear entry points */}
        <section className="pb-16">
          <div className="text-center mb-10">
            <div className="marginalia">What you can do</div>
            <h3 className="mt-2 font-display text-3xl md:text-4xl">Four sections. One election.</h3>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              icon={<Vote size={24} />}
              to="/vote"
              title="Cast a Ballot"
              body="Enter your voter ID, verify with a one-time code, mark your ballot, and receive a private receipt."
              cta="Enter polling room"
            />
            <ActionCard
              icon={<ScrollText size={24} />}
              to="/ledger"
              title="Public Ledger"
              body="Every ballot cast so far, in a tamper-evident hash chain, with a live tally."
              cta="Browse ledger"
            />
            <ActionCard
              icon={<ShieldCheck size={24} />}
              to="/verify"
              title="Verify a Receipt"
              body="Confirm your receipt is on the ledger and run an independent recount of the entire chain."
              cta="Verify now"
            />
            <ActionCard
              icon={<FileText size={24} />}
              to="/admin"
              title="Ballot of Record"
              body="The locked ballot, published in full with cryptographic hash and chain of custody."
              cta="Read of record"
            />
          </div>
        </section>

        {/* SIX PRINCIPLES */}
        <section className="py-16 border-t-2 border-ink">
          <div className="max-w-2xl mb-10">
            <div className="marginalia">Six principles</div>
            <h3 className="mt-2 font-display text-3xl md:text-4xl">The rules the system defers to.</h3>
            <p className="mt-4 text-ink-soft text-lg">
              Every decision defers to these. Where a convenience would compromise them, the convenience is refused.
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="py-6 border-t border-ink/20">
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-3xl text-stamp shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4 className="font-display text-xl">{p.title}</h4>
                    <p className="mt-2 text-base leading-relaxed text-ink-soft">{p.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CANDIDATES */}
        <section className="py-16 border-t-2 border-ink">
          <div className="max-w-2xl mb-10">
            <div className="marginalia">Standing for office</div>
            <h3 className="mt-2 font-display text-3xl md:text-4xl">The candidates this session.</h3>
          </div>

          {POSITIONS.map((pos) => {
            const cands = CANDIDATES.filter(c => c.position_id === pos.id)
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={pos.id} className="mb-12">
                <div className="mb-5 pb-3 border-b border-ink/25">
                  <div className="marginalia">Position</div>
                  <h4 className="font-display text-2xl md:text-3xl italic mt-1">{pos.name}</h4>
                  <p className="mt-2 text-base text-ink-soft">{pos.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cands.map(c => (
                    <div key={c.id} className="border-2 border-ink/20 bg-card p-5 flex gap-4">
                      <div
                        className="h-16 w-16 shrink-0 border-2 border-ink flex items-center justify-center font-display text-lg text-paper"
                        style={{ background: candidateAvatar(c.photo_hue) }}
                      >
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg leading-tight">{c.name}</div>
                        <p className="mt-2 text-sm text-ink-soft leading-relaxed">{c.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* CALL TO CAST */}
        <section className="py-20 text-center border-t-2 border-ink">
          <div className="marginalia">Adjournment</div>
          <h3 className="mt-4 font-display text-[clamp(2rem,5vw,4rem)] leading-[1.05]">
            You have one <em className="italic">ballot</em>. Cast it well.
          </h3>
          <div className="mt-9">
            <Link to="/vote" className="btn-primary hover:bg-stamp hover:border-stamp text-base px-8 py-4">
              <Vote size={20} />
              Enter the polling room
              <ArrowRight size={18} />
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
    <div className="text-center">
      <div className="font-display text-3xl md:text-4xl leading-none">{n}</div>
      <div className="marginalia mt-2">{l}</div>
    </div>
  );
}

function ActionCard({
  icon, to, title, body, cta,
}: { icon: React.ReactNode; to: string; title: string; body: string; cta: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col border-2 border-ink bg-card p-6 hover:bg-ink hover:text-paper transition-colors"
    >
      <div className="text-stamp group-hover:text-paper transition-colors">{icon}</div>
      <h4 className="mt-4 font-display text-xl">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft group-hover:text-paper/85 transition-colors flex-1">
        {body}
      </p>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
        {cta} <ArrowRight size={16} />
      </div>
    </Link>
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
