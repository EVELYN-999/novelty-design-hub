// Mock election data for the prototype. All hashes/tokens are illustrative.

export type Candidate = {
  id: string;
  name: string;
  position_id: string;
  bio: string;
  photo_hue: number; // for generated avatar tint
};

export type Position = { id: string; name: string; description: string };

export const ELECTION = {
  id: "elx-2026-annual",
  title: "Annual General Election",
  organisation: "The Herald Society",
  opens: "07 July 2026 · 09:00 GMT",
  closes: "14 July 2026 · 21:00 GMT",
  eligible_voters: 1284,
  ballot_hash:
    "0x9f3ac2b1e8d47c50a1b6f9d2c7e83b04a12f7e6d5b8c9a0e3f1d2c4b6a8e0f2c",
  ballot_locked_at: "05 July 2026 · 18:42 GMT",
  signing_key_fp: "BLS-RSA 4096 · 3A:F2:9C:81:B0:44:E7:29",
};

export const POSITIONS: Position[] = [
  { id: "pos-chair", name: "Chairperson", description: "Presides over the Society and its council." },
  { id: "pos-treas", name: "Treasurer", description: "Custodian of the accounts and annual audit." },
  { id: "pos-sec", name: "Secretary", description: "Keeper of records, minutes, and correspondence." },
];

export const CANDIDATES: Candidate[] = [
  { id: "c-1", position_id: "pos-chair", name: "Ada Whitmore", bio: "Sitting councillor since 2021. Advocates for open records.", photo_hue: 24 },
  { id: "c-2", position_id: "pos-chair", name: "Emil Vasquez", bio: "Former editor. Ran the 2024 reform committee.", photo_hue: 210 },
  { id: "c-3", position_id: "pos-chair", name: "Nadia Okoro", bio: "Lawyer. Chaired the transparency working group.", photo_hue: 140 },

  { id: "c-4", position_id: "pos-treas", name: "Beatrice Lyle", bio: "Chartered accountant. Society member since 2015.", photo_hue: 340 },
  { id: "c-5", position_id: "pos-treas", name: "Marcus Ivanov", bio: "Ran the pensioners' fund for six consecutive years.", photo_hue: 60 },

  { id: "c-6", position_id: "pos-sec", name: "Clara Devi", bio: "Archivist. Digitised the 1974 minutes.", photo_hue: 280 },
  { id: "c-7", position_id: "pos-sec", name: "Yusuf Bell", bio: "Journalist. Emphasises accessible reporting.", photo_hue: 180 },
];

// Mock hash-chained ledger entries (already cast votes, anonymised)
export type LedgerEntry = {
  index: number;
  timestamp: string;
  token: string; // truncated
  prev_hash: string;
  hash: string;
  selections: { position: string; candidate: string }[];
};

function h(seed: string) {
  // deterministic pseudo-hash for display
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out += hex[x % 16];
  }
  return out;
}

const times = [
  "07 Jul · 09:04:12", "07 Jul · 09:07:58", "07 Jul · 09:12:03",
  "07 Jul · 09:18:44", "07 Jul · 09:21:19", "07 Jul · 09:26:02",
  "07 Jul · 09:31:41", "07 Jul · 09:38:15", "07 Jul · 09:44:52",
  "07 Jul · 09:51:33", "07 Jul · 09:58:20", "07 Jul · 10:03:47",
];

const picks = [
  ["Ada Whitmore", "Beatrice Lyle", "Clara Devi"],
  ["Emil Vasquez", "Marcus Ivanov", "Yusuf Bell"],
  ["Nadia Okoro", "Beatrice Lyle", "Clara Devi"],
  ["Ada Whitmore", "Marcus Ivanov", "Yusuf Bell"],
  ["Nadia Okoro", "Beatrice Lyle", "Yusuf Bell"],
  ["Emil Vasquez", "Marcus Ivanov", "Clara Devi"],
  ["Ada Whitmore", "Beatrice Lyle", "Clara Devi"],
  ["Nadia Okoro", "Marcus Ivanov", "Yusuf Bell"],
  ["Ada Whitmore", "Beatrice Lyle", "Yusuf Bell"],
  ["Emil Vasquez", "Beatrice Lyle", "Clara Devi"],
  ["Nadia Okoro", "Marcus Ivanov", "Clara Devi"],
  ["Ada Whitmore", "Beatrice Lyle", "Clara Devi"],
];

export const LEDGER: LedgerEntry[] = (() => {
  let prev = ELECTION.ballot_hash;
  return times.map((t, i) => {
    const token = h(`token-${i}`).slice(0, 22);
    const hash = h(`entry-${i}-${prev}`);
    const entry: LedgerEntry = {
      index: i + 1,
      timestamp: t,
      token,
      prev_hash: prev,
      hash,
      selections: [
        { position: "Chairperson", candidate: picks[i][0] },
        { position: "Treasurer", candidate: picks[i][1] },
        { position: "Secretary", candidate: picks[i][2] },
      ],
    };
    prev = hash;
    return entry;
  });
})();

export const TALLY = (() => {
  const map = new Map<string, number>();
  for (const e of LEDGER)
    for (const s of e.selections)
      map.set(`${s.position}|${s.candidate}`, (map.get(`${s.position}|${s.candidate}`) ?? 0) + 1);
  const grouped: Record<string, { candidate: string; votes: number }[]> = {};
  for (const [k, v] of map.entries()) {
    const [pos, cand] = k.split("|");
    (grouped[pos] ??= []).push({ candidate: cand, votes: v });
  }
  for (const k of Object.keys(grouped))
    grouped[k].sort((a, b) => b.votes - a.votes);
  return grouped;
})();

export function candidateAvatar(hue: number) {
  // returns a CSS background for a woodcut-style monogram tile
  return `linear-gradient(135deg, oklch(0.72 0.08 ${hue}) 0%, oklch(0.42 0.09 ${hue}) 100%)`;
}
