export type ModelKey = "blend" | "logreg" | "hgb" | "poisson";

export type Probs = [number, number, number];

export interface Meta {
  generatedAt: string;
  trainedOn: string;
  nMatches: number;
  seasons: [number, number];
  lastMatch: string;
  nFeatures: number;
  remaining: number;
  nSims: number;
  season: number;
  simDate: string;
  teams: string[];
  models: { key: ModelKey; label: string; full: string }[];
}

export interface Fixture {
  home: string;
  away: string;
  matchday: number;
  date: string;
  probs: Record<ModelKey, Probs>;
  xg: [number, number];
}

export interface Standing {
  team: string;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  ppg: number;
  elo: number;
  form5Ppg: number;
  form5Gf: number;
  form5Ga: number;
  form: string;
  prevPosition: number | null;
  promoted: boolean;
}

export interface SimRow {
  team: string;
  position_now: number;
  points_now: number;
  points_mean: number;
  points_p5: number;
  points_p95: number;
  position_mean: number;
  prob_title: number;
  prob_top4: number;
  prob_relegation: number;
}

export interface TeamGame {
  date: string;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "V" | "E" | "D";
}

export interface TeamHistory {
  team: string;
  elo: [string, number][];
  games: TeamGame[];
}

export interface MetricRow {
  rank: number;
  model: string;
  n: number;
  accuracy: number;
  log_loss: number;
  brier: number;
  rps: number;
  pretty: string;
}

export interface SeasonMetric {
  season: number;
  model: string;
  n: number;
  accuracy: number;
  log_loss: number;
  brier: number;
  rps: number;
  pretty: string;
}

export interface ImportanceRow {
  feature: string;
  importance: number;
  std: number;
}

export interface PerformanceData {
  metrics: MetricRow[];
  seasons: SeasonMetric[];
  importance: ImportanceRow[];
}

export interface BacktestSummaryRow {
  mercado: string;
  n: number;
  modelo_log_loss: number;
  mercado_log_loss: number;
  modelo_brier: number;
  mercado_brier: number;
  modelo_rps: number;
  mercado_rps: number;
  modelo_acc: number;
  mercado_acc: number;
}

export interface BacktestBootstrapRow {
  mercado: string;
  n: number;
  delta_log_loss: number;
  ic95_lo: number;
  ic95_hi: number;
  significativo: boolean;
}

export interface BacktestBettingRow {
  mercado: string;
  edge_minimo: number;
  apostas_modelo: number;
  roi_modelo: number;
  odd_media_modelo: number;
  apostas_placebo: number;
  roi_placebo: number | null;
}

export interface BacktestData {
  summary: BacktestSummaryRow[];
  bootstrap: BacktestBootstrapRow[];
  betting: BacktestBettingRow[];
}

export interface CalibrationBin {
  bin: number;
  p_mean: number;
  freq: number;
  n: number;
}

export interface CalibrationData {
  model: CalibrationBin[];
  market: CalibrationBin[];
}

export interface ConfusionData {
  labels: string[];
  matrix: number[][];
}

export interface AppData {
  meta: Meta;
  standings: Standing[];
  simulation: SimRow[];
  fixtures: Fixture[];
  teams: TeamHistory[];
  performance: PerformanceData;
  backtest: BacktestData;
  calibration: CalibrationData;
  confusion: ConfusionData;
  fixtureIndex: Map<string, Fixture>;
}
