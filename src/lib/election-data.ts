// Static metadata only. Ballot definition (positions/candidates) lives in the DB.
export const ELECTION = {
  id: "elx-2026-annual",
  title: "General Election MMXXVI",
  organisation: "Node Assembly",
  eligible_voters_fallback: 20,
  signing_key_fp: "BLS-RSA 4096 · 3A:F2:9C:81:B0:44:E7:29",
};

// Deterministic accent colour per candidate id (for avatars).
export function accentFor(id: string): string {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  const hues = [78, 190, 320, 45, 260, 155, 15];
  return `oklch(0.78 0.19 ${hues[x % hues.length]})`;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}
