import type {
  AppData,
  BacktestData,
  CalibrationData,
  ConfusionData,
  Fixture,
  Meta,
  PerformanceData,
  SimRow,
  Standing,
  TeamHistory,
} from "./types";

async function getJson<T>(name: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${name}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${name} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function loadAppData(): Promise<AppData> {
  const [meta, standings, simulation, fixtures, teams, performance, backtest, calibration, confusion] =
    await Promise.all([
      getJson<Meta>("meta.json"),
      getJson<Standing[]>("standings.json"),
      getJson<SimRow[]>("simulation.json"),
      getJson<Fixture[]>("fixtures.json"),
      getJson<TeamHistory[]>("teams.json"),
      getJson<PerformanceData>("performance.json"),
      getJson<BacktestData>("backtest.json"),
      getJson<CalibrationData>("calibration.json"),
      getJson<ConfusionData>("confusion.json"),
    ]);

  const fixtureIndex = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    fixtureIndex.set(`${fixture.home}|${fixture.away}`, fixture);
  }

  return {
    meta,
    standings,
    simulation,
    fixtures,
    teams,
    performance,
    backtest,
    calibration,
    confusion,
    fixtureIndex,
  };
}
