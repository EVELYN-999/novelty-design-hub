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
      <main className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="py-8 grid grid-cols-12 gap-8 items-end border-b-2 border-ink">
          <div className="col-span-12 md:col-span-9">
            <div className="marginalia">Section · Ballot of Record</div>
            <h2 className="mt-2 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.95]">
              The <em className="italic">locked</em> ballot, published in full.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-3 flex md:justify-end">
            <div className="stamp-block text-center">
              <div className="font-display italic text-xl">Locked</div>
              <div className="marginalia mt-1">{ELECTION.ballot_locked_at}</div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-12 gap-8 py-12">
          <aside className="col-span-12 md:col-span-4 space-y-5">
            <div className="border-2 border-ink p-5">
              <div className="marginalia">Ballot hash · public</div>
              <p className="hash-mono mt-2">{ELECTION.ballot_hash}</p>
              <div className="rule-hair my-4" />
              <div className="marginalia">Election ID</div>
              <p className="text-sm font-mono">{ELECTION.id}</p>
              <div className="marginalia mt-3">Signing key fingerprint</div>
              <p className="hash-mono mt-1">{ELECTION.signing_key_fp}</p>
              <div className="marginalia mt-3">Eligible voters</div>
              <p className="text-sm">{ELECTION.eligible_voters.toLocaleString()}</p>
              <div className="marginalia mt-3">Poll window</div>
              <p className="text-sm">{ELECTION.opens} → {ELECTION.closes}</p>
            </div>

            <div className="border-2 border-ink/40 p-5">
              <div className="marginalia">Chain of custody</div>
              <ol className="mt-3 space-y-3 text-sm">
                <li><span className="text-ink-soft">03 Jul · 12:14</span> — draft positions created</li>
                <li><span className="text-ink-soft">04 Jul · 09:02</span> — candidates uploaded</li>
                <li><span className="text-ink-soft">04 Jul · 17:41</span> — photos verified</li>
                <li><span className="text-ink-soft">05 Jul · 18:42</span> — <span className="font-display italic">ballot locked</span></li>
                <li><span className="text-ink-soft">05 Jul · 18:42</span> — hash published</li>
                <li><span className="text-ink-soft">07 Jul · 09:00</span> — polls opened</li>
              </ol>
            </div>

            <div className="border-2 border-ink/40 p-5">
              <div className="marginalia">Post-lock constraints</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li>· No positions may be added, edited or removed.</li>
                <li>· No candidates may be added or withdrawn.</li>
                <li>· No eligibility changes; snapshot is frozen.</li>
                <li>· Enforced at the database, not the interface.</li>
              </ul>
            </div>
          </aside>

          <section className="col-span-12 md:col-span-8">
            <div className="marginalia">Published ballot · as voters see it</div>
            <div className="rule-double my-4" />

            {POSITIONS.map((pos, i) => {
              const cands = CANDIDATES.filter(c => c.position_id === pos.id)
                .sort((a, b) => a.name.localeCompare(b.name));
              return (
                <article key={pos.id} className="mb-10">
                  <header className="flex items-baseline justify-between">
                    <div>
                      <div className="marginalia">Article {["I","II","III","IV","V"][i]}</div>
                      <h3 className="font-display text-3xl italic">{pos.name}</h3>
                      <p className="text-sm text-ink-soft mt-1">{pos.description}</p>
                    </div>
                    <div className="marginalia">Single winner</div>
                  </header>
                  <div className="rule-hair my-4" />
                  <ol className="divide-y divide-ink/20">
                    {cands.map((c, ci) => (
                      <li key={c.id} className="py-4 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 font-display text-2xl text-ink-soft text-center">
                          {String(ci + 1).padStart(2, "0")}
                        </div>
                        <div className="col-span-2">
                          <div
                            className="h-16 w-16 border-2 border-ink flex items-center justify-center font-display text-lg text-paper"
                            style={{ background: candidateAvatar(c.photo_hue) }}
                          >
                            {c.name.split(" ").map(n => n[0]).join("")}
                          </div>
                        </div>
                        <div className="col-span-6">
                          <div className="font-display text-xl">{c.name}</div>
                          <p className="text-xs text-ink-soft mt-1">{c.bio}</p>
                        </div>
                        <div className="col-span-3 text-right hash-mono">{c.id}</div>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </section>
        </section>
      </main>
      <Colophon />
    </div>
  );
}
