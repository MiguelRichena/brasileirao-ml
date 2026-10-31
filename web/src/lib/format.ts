export const int = new Intl.NumberFormat("pt-BR");

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function decimal(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function signed(value: number, digits = 2): string {
  const formatted = decimal(Math.abs(value), digits);
  return `${value >= 0 ? "+" : "−"}${formatted}`;
}

export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

export function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

/** Distribuicao de placares de um modelo Poisson independente. */
export function poissonMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 6) {
  const pmf = (lambda: number, k: number) => {
    let factorial = 1;
    for (let i = 2; i <= k; i += 1) factorial *= i;
    return (Math.exp(-lambda) * lambda ** k) / factorial;
  };

  const home = Array.from({ length: maxGoals + 1 }, (_, k) => pmf(lambdaHome, k));
  const away = Array.from({ length: maxGoals + 1 }, (_, k) => pmf(lambdaAway, k));
  const total = home.reduce((a, b) => a + b, 0) * away.reduce((a, b) => a + b, 0);

  const grid = home.map((ph) =>
    away.map((pa) => (ph * pa) / total),
  );

  const scores = grid.flatMap((row, h) =>
    row.map((probability, a) => ({
      home: h,
      away: a,
      probability,
      outcome: h > a ? "H" : h === a ? "D" : "A",
    })),
  );

  return {
    grid,
    scores: scores.sort((a, b) => b.probability - a.probability),
    max: Math.max(...scores.map((s) => s.probability)),
  };
}

export const resultLabel: Record<string, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

export const outcomeLabels = ["Casa", "Empate", "Fora"];

export const featureLabels: Record<string, string> = {
  elo_diff: "Diferença de Elo",
  elo_home: "Elo do mandante",
  elo_away: "Elo do visitante",
  elo_home_adv: "Elo + vantagem de casa",
  season_gdpg_home: "Saldo/jogo do mandante",
  season_gdpg_away: "Saldo/jogo do visitante",
  season_ppg_home: "Pontos/jogo do mandante",
  season_ppg_away: "Pontos/jogo do visitante",
  season_ppg_diff: "Diferença de pontos/jogo",
  form5_ppg_home: "Forma (5) do mandante",
  form5_ppg_away: "Forma (5) do visitante",
  form5_ppg_diff: "Diferença de forma (5)",
  form10_ppg_home: "Forma (10) do mandante",
  form10_ppg_away: "Forma (10) do visitante",
  form10_ppg_diff: "Diferença de forma (10)",
  form5_gf_home: "Gols pró (5) do mandante",
  form5_gf_away: "Gols pró (5) do visitante",
  form5_ga_home: "Gols contra (5) do mandante",
  form5_ga_away: "Gols contra (5) do visitante",
  form5_attack_diff: "Ataque × defesa",
  form5_defense_diff: "Defesa × ataque",
  pos_home: "Posição do mandante",
  pos_away: "Posição do visitante",
  pos_diff: "Diferença de posição",
  prev_pos_home: "Posição anterior (mandante)",
  prev_pos_away: "Posição anterior (visitante)",
  rest_home: "Descanso do mandante",
  rest_away: "Descanso do visitante",
  rest_diff: "Diferença de descanso",
  promoted_home: "Recém-promovido (mandante)",
  promoted_away: "Recém-promovido (visitante)",
  matchday: "Rodada",
};
