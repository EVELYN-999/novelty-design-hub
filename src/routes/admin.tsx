import { createFileRoute } from "@tanstack/react-router";
import { Masthead, Colophon } from "@/components/masthead";
import { ELECTION, POSITIONS, CANDIDATES, candidateAvatar } from "@/lib/election-data";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Ballot of Record — The Ballot Gazette" },
      { name: "description", content: "The locked ballot exactly as voters will see it, published with hash and timestamp for public inspection." },
    ],
  }),
});

function AdminPage() {
  return (
    <div className="min-h-screen">
      <Masthead compact />
      <main className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <div className="py-10 border-b-2 border-ink flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="marginalia">Ballot of Record</div>
            <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
              The <em className="italic">locked</em> ballot, published in full.
            </h2>
            <p className="mt-3 text-lg text-ink-soft max-w-2xl">
              What voters see, exactly as they see it — with the cryptographic hash and chain of custody.
            </p>
          </div>
          <div className="stamp-block text-center">
            <div className="font-display italic text-xl">Locked</div>
            <div className="marginalia mt-1">{ELECTION.ballot_locked_at}</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 py-10">
          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <div className="border-2 border-ink p-5 bg-card space-y-4">
              <div>
                <div className="marginalia">Ballot hash · public</div>
                <p className="hash-mono mt-2">{ELECTION.ballot_hash}</p>
              </div>
              <div className="rule-hair" />
              <MetaRow label="Election ID" value={ELECTION.id} />
              <MetaRow label="Signing key" value={ELECTION.signing_key_fp} mono />
              <MetaRow label="Eligible voters" value={ELECTION.eligible_voters.toLocaleString()} />
              <MetaRow label="Poll window" value={`${ELECTION.opens} → ${ELECTION.closes}`} />
            </div>

            <div className="border-2 border-ink/30 p-5">
              <div className="marginalia mb-3">Chain of custody</div>
              <ol className="space-y-3 text-base">
                {CUSTODY.map(c => (
                  <li key={c.t} className="flex gap-3">
                    <span className="text-ink-soft font-mono text-sm w-32 shrink-0">{c.t}</span>
                    <span className={c.bold ? "font-semibold" : ""}>{c.event}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-2 border-ink/30 p-5">
              <div className="marginalia mb-3">Post-lock constraints</div>
              <ul className="space-y-2 text-base">
                <li>· No positions added, edited or removed.</li>
                <li>· No candidates added or withdrawn.</li>
                <li>· No eligibility changes; snapshot frozen.</li>
                <li>· Enforced at the database, not the UI.</li>
              </ul>
            </div>
          </aside>

          {/* Published ballot */}
          <section className="col-span-12 lg:col-span-8">
            <div className="marginalia">Published ballot — as voters see it</div>
            <div className="rule-double my-4" />

            {POSITIONS.map((pos, i) => {
              const cands = CANDIDATES.filter(c => c.position_id === pos.id)
                .sort((a, b) => a.name.localeCompare(b.name));
              return (
                <article key={pos.id} className="mb-12">
                  <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                    <div>
                      <div className="marginalia">Article {["I","II","III","IV","V"][i]}</div>
                      <h3 className="font-display text-2xl md:text-3xl italic mt-1">{pos.name}</h3>
                      <p className="text-base text-ink-soft mt-1">{pos.description}</p>
                    </div>
                    <div className="marginalia">Single winner</div>
                  </header>
                  <ol className="border-2 border-ink/20 divide-y-2 divide-ink/15">
                    {cands.map((c, ci) => (
                      <li key={c.id} className="p-4 flex flex-wrap items-center gap-4 bg-card">
                        <div className="font-display text-2xl text-ink-soft w-10 text-center shrink-0">
                          {String(ci + 1).padStart(2, "0")}
                        </div>
                        <div
                          className="h-14 w-14 shrink-0 border-2 border-ink flex items-center justify-center font-display text-base text-paper"
                          style={{ background: candidateAvatar(c.photo_hue) }}
                        >
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-display text-lg">{c.name}</div>
                          <p className="text-sm text-ink-soft mt-0.5">{c.bio}</p>
                        </div>
                        <div className="hash-mono text-sm ml-auto">{c.id}</div>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </section>
        </div>
      </main>
      <Colophon />
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="marginalia">{label}</div>
      <p className={`mt-1 text-base ${mono ? "font-mono text-sm break-all" : ""}`}>{value}</p>
    </div>
  );
}

const CUSTODY = [
  { t: "03 Jul · 12:14", event: "Draft positions created" },
  { t: "04 Jul · 09:02", event: "Candidates uploaded" },
  { t: "04 Jul · 17:41", event: "Photos verified" },
  { t: "05 Jul · 18:42", event: "Ballot locked", bold: true },
  { t: "05 Jul · 18:42", event: "Hash published" },
  { t: "07 Jul · 09:00", event: "Polls opened" },
];
