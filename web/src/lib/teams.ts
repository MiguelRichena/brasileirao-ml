const abbreviations: Record<string, string> = {
  Flamengo: "FLA",
  Palmeiras: "PAL",
  Cruzeiro: "CRU",
  Botafogo: "BOT",
  Fluminense: "FLU",
  "São Paulo": "SAO",
  Internacional: "INT",
  Corinthians: "COR",
  Bahia: "BAH",
  "Atlético-MG": "CAM",
  "Grêmio": "GRE",
  Vasco: "VAS",
  Santos: "SAN",
  Bragantino: "RBB",
  Coritiba: "CTB",
  "Vitória": "VIT",
  Mirassol: "MIR",
  Remo: "REM",
  Chapecoense: "CHA",
  "Athletico-PR": "CAP",
};

const colors: Record<string, [string, string]> = {
  Flamengo: ["#f87171", "#7f1d1d"],
  Palmeiras: ["#4ade80", "#14532d"],
  Cruzeiro: ["#60a5fa", "#1e3a8a"],
  Botafogo: ["#e2e8f0", "#334155"],
  Fluminense: ["#fb7185", "#14532d"],
  "São Paulo": ["#f87171", "#111827"],
  Internacional: ["#fb7185", "#7f1d1d"],
  Corinthians: ["#e5e7eb", "#1f2937"],
  Bahia: ["#60a5fa", "#172554"],
  "Atlético-MG": ["#fbbf24", "#111827"],
  "Grêmio": ["#7dd3fc", "#0c4a6e"],
  Vasco: ["#cbd5e1", "#111827"],
  Santos: ["#f1f5f9", "#334155"],
  Bragantino: ["#fca5a5", "#7f1d1d"],
  Coritiba: ["#86efac", "#14532d"],
  "Vitória": ["#fdba74", "#7c2d12"],
  Mirassol: ["#fde047", "#854d0e"],
  Remo: ["#93c5fd", "#1e3a8a"],
  Chapecoense: ["#86efac", "#166534"],
  "Athletico-PR": ["#fca5a5", "#111827"],
};

const fallback: [string, string] = ["#6ee7b7", "#0f766e"];

export function teamAbbr(team: string): string {
  return abbreviations[team] ?? team.slice(0, 3).toUpperCase();
}

export function teamColors(team: string): [string, string] {
  return colors[team] ?? fallback;
}
