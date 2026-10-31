import { ArrowDownUp, Info, Target } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppData, Fixture, ModelKey } from "../lib/types";
import { decimal, longDate, outcomeLabels, pct, poissonMatrix } from "../lib/format";
import { teamColors } from "../lib/teams";
import { TeamPicker } from "./TeamPicker";
import { SectionHeader } from "./ui/SectionHeader";
import { Reveal } from "./ui/Reveal";

const modelDescriptions: Record<ModelKey, string> = {
  blend: "Média das probabilidades do LogReg e do Gradient Boosting. É o modelo de destaque do projeto.",
  logreg: "Regressão logística com as 32 features normalizadas e regularização forte.",
  hgb: "Gradient boosting regularizado, com árvores pequenas para não decorar o passado.",
  poisson: "Modelo de gols independente; as probabilidades 1X2 vêm da matriz completa de placares.",
};

const outcomeColors = ["bg-mint-400", "bg-slate-400", "bg-teal-600"];
const outcomeText = ["text-mint-300", "text-slate-300", "text-teal-300"];

function ScoreMatrix({ fixture }: { fixture: Fixture }) {
  const { grid, scores, max } = useMemo(
    () => poissonMatrix(fixture.xg[0], fixture.xg[1], 6),
    [fixture.xg[0], fixture.xg[1]],
  );
  const maxGoals = grid.length - 1;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          className="mx-auto grid min-w-[300px] gap-1"
          style={{ gridTemplateColumns: "1.4rem repeat(7, minmax(0, 1fr))" }}
          role="img"
          aria-label={`Matriz de placares entre ${fixture.home} e ${fixture.away}`}
        >
          <span />
          {Array.from({ length: maxGoals + 1 }, (_, goal) => (
            <span key={`col-${goal}`} className="pb-1 text-center font-mono text-[0.55rem] text-mist/60">
              {goal}
            </span>
          ))}
          {grid.map((row, homeGoals) => (
            <div key={`row-${homeGoals}`} className="contents">
              <span className="grid place-items-center font-mono text-[0.55rem] text-mist/60">
                {homeGoals}
              </span>
              {row.map((probability, awayGoals) => {
                const intensity = max > 0 ? probability / max : 0;
                const isPeak = probability === max;
                return (
                  <div
                    key={`${homeGoals}-${awayGoals}`}
                    title={`${homeGoals} × ${awayGoals} — ${pct(probability, 2)}`}
                    className={`grid aspect-square place-items-center rounded-[5px] border font-mono text-[0.53rem] transition-transform hover:scale-105 ${
                      isPeak ? "border-lime-300/70" : "border-transparent"
                    } ${intensity > 0.42 ? "text-[#04110b]" : "text-mist/80"}`}
                    style={{
                      backgroundColor: `rgba(52, 211, 153, ${0.05 + intensity * 0.8})`,
                    }}
                  >
                    {probability >= 0.02 ? (probability * 100).toFixed(0) : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-[0.58rem] text-mist/60">
        <span>
          <span className="text-mist">linhas</span> = gols {fixture.home}
        </span>
        <span>
          <span className="text-mist">colunas</span> = gols {fixture.away}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {scores.slice(0, 4).map((score) => (
          <span
            key={`${score.home}-${score.away}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[0.65rem] text-chalk"
          >
            {score.home}–{score.away}
            <span className="text-mint-300">{pct(score.probability, 1)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Simulator({ data, initial }: { data: AppData; initial: Fixture }) {
  const [home, setHome] = useState(initial.home);
  const [away, setAway] = useState(initial.away);
  const [model, setModel] = useState<ModelKey>("blend");

  const fixture = data.fixtureIndex.get(`${home}|${away}`) ?? initial;
  const probs = fixture.probs[model];
  const winner = probs.indexOf(Math.max(...probs));
  const [homeFrom, homeTo] = teamColors(home);
  const [awayFrom, awayTo] = teamColors(away);

  const chooseHome = (team: string) => {
    if (team === away) setAway(home);
    setHome(team);
  };
  const chooseAway = (team: string) => {
    if (team === home) setHome(away);
    setAway(team);
  };
  const swap = () => {
    setHome(away);
    setAway(home);
  };

  const outcomes = [
    {
      label: `Vitória ${fixture.home}`,
      short: fixture.home,
      value: probs[0],
      color: "border-mint-400/60",
    },
    { label: "Empate", short: "Empate", value: probs[1], color: "border-slate-400/60" },
    {
      label: `Vitória ${fixture.away}`,
      short: fixture.away,
      value: probs[2],
      color: "border-teal-500/60",
    },
  ];

  const bestByColumn = [0, 1, 2].map((column) =>
    Math.max(...data.meta.models.map((item) => fixture.probs[item.key][column])),
  );

  return (
    <section id="simulador" className="relative border-t border-white/[0.05] py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          eyebrow="Simulador 1X2"
          title={
            <>
              Escolha o confronto.
              <br />
              <span className="text-gradient">Veja o que o modelo acha.</span>
            </>
          }
          description="Probabilidades de vitória, empate e derrota para qualquer um dos 380 confrontos possíveis entre os 20 times. O Poisson adiciona gols esperados e a distribuição completa de placares."
          aside={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="chip">
                <Target className="h-3 w-3 text-mint-300" />
                {data.meta.remaining} jogos restantes
              </span>
              <span className="chip">Rodada {fixture.matchday}</span>
            </div>
          }
        />

        <Reveal delay={0.05} className="mt-10">
          <div className="panel relative overflow-hidden rounded-[1.6rem] p-5 md:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint-300/40 to-transparent" />
            <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
              <TeamPicker
                label="Mandante"
                value={home}
                teams={data.meta.teams}
                disabledTeam={away}
                onChange={chooseHome}
              />
              <button
                type="button"
                onClick={swap}
                className="mx-auto grid h-10 w-10 place-items-center self-end rounded-full border border-white/12 bg-white/[0.04] text-mist transition-all hover:rotate-180 hover:border-mint-400/40 hover:text-mint-300 md:mb-1"
                aria-label="Inverter mando de campo"
                title="Inverter mando de campo"
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
              <TeamPicker
                label="Visitante"
                value={away}
                teams={data.meta.teams}
                disabledTeam={home}
                onChange={chooseAway}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[0.68rem] text-mist">
              <span>
                Mando: <span className="text-chalk">{home}</span> · data de referência{" "}
                {longDate(fixture.date)}
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-mist/60">
                {fixture.matchday}ª rodada aprox.
              </span>
            </div>
          </div>
        </Reveal>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal delay={0.08} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-medium text-chalk">Probabilidade por resultado</h3>
                  <p className="mt-0.5 text-[0.72rem] text-mist">Modelo em destaque</p>
                </div>
                <div className="flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-black/20 p-1">
                  {data.meta.models.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setModel(item.key)}
                      aria-pressed={model === item.key}
                      className={`rounded-full px-3 py-1.5 text-[0.7rem] font-medium transition-colors ${
                        model === item.key
                          ? "bg-mint-400/15 text-mint-300"
                          : "text-mist hover:text-chalk"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex items-center justify-center gap-2 sm:gap-4 md:gap-7">
                <div className="flex w-14 shrink-0 flex-col items-center gap-2 sm:w-20 md:w-auto">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 font-display text-[0.66rem] font-semibold text-white md:h-14 md:w-14 md:text-[0.76rem]"
                    style={{ background: `linear-gradient(145deg, ${homeFrom}, ${homeTo})` }}
                  >
                    {fixture.home.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="w-full truncate text-center text-[0.66rem] text-mist sm:text-[0.7rem]">
                    {fixture.home}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <div className="flex w-full justify-center gap-1 sm:gap-1.5">
                    {probs.map((value, index) => (
                      <div
                        key={index}
                        className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border-t-2 bg-white/[0.02] px-1 py-2.5 sm:py-3 ${outcomes[index].color}`}
                      >
                        <span className={`num text-base font-medium sm:text-xl md:text-2xl ${outcomeText[index]}`}>
                          {pct(value, 1)}
                        </span>
                        <span className="mt-1 hidden truncate text-[0.6rem] text-mist sm:block">
                          {outcomeLabels[index]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    {probs.map((value, index) => (
                      <span
                        key={index}
                        className={`${outcomeColors[index]} transition-all duration-500`}
                        style={{ width: `${value * 100}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex w-14 shrink-0 flex-col items-center gap-2 sm:w-20 md:w-auto">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 font-display text-[0.66rem] font-semibold text-white md:h-14 md:w-14 md:text-[0.76rem]"
                    style={{ background: `linear-gradient(145deg, ${awayFrom}, ${awayTo})` }}
                  >
                    {fixture.away.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="w-full truncate text-center text-[0.66rem] text-mist sm:text-[0.7rem]">
                    {fixture.away}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300/80" />
                <p className="text-[0.72rem] leading-relaxed text-mist">
                  {modelDescriptions[model]} O resultado mais provável é{" "}
                  <span className="text-chalk">
                    {winner === 1 ? "empate" : `vitória do ${winner === 0 ? fixture.home : fixture.away}`}
                  </span>{" "}
                  ({pct(probs[winner], 1)}).
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-medium text-chalk">Gols esperados</h3>
                  <p className="mt-0.5 text-[0.72rem] text-mist">Poisson · independente por time</p>
                </div>
                <span className="chip !text-[0.6rem]">
                  total {decimal(fixture.xg[0] + fixture.xg[1], 2)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                  <div className="num text-2xl font-medium text-mint-300">{decimal(fixture.xg[0])}</div>
                  <div className="mt-1 truncate text-[0.62rem] text-mist">{fixture.home}</div>
                </div>
                <span className="font-mono text-[0.62rem] text-mist/50">×</span>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                  <div className="num text-2xl font-medium text-teal-300">{decimal(fixture.xg[1])}</div>
                  <div className="mt-1 truncate text-[0.62rem] text-mist">{fixture.away}</div>
                </div>
              </div>

              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <h4 className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/70">
                  Placar exato · top 4
                </h4>
                <div className="mt-2 space-y-1.5">
                  {poissonMatrix(fixture.xg[0], fixture.xg[1], 6)
                    .scores.slice(0, 4)
                    .map((score) => (
                      <div
                        key={`${score.home}-${score.away}`}
                        className="flex items-center gap-2 text-[0.72rem]"
                      >
                        <span className="num w-9 text-chalk">
                          {score.home}–{score.away}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-mint-400/80 to-lime-300/80"
                            style={{ width: `${(score.probability / 0.15) * 100}%` }}
                          />
                        </div>
                        <span className="num w-12 text-right text-mist">
                          {pct(score.probability, 1)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal delay={0.1} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <h3 className="font-display text-lg font-medium text-chalk">Comparação entre modelos</h3>
              <p className="mt-1 text-[0.72rem] text-mist">
                Todos usam as mesmas features. O Poisson enxerga apenas gols.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-[0.78rem]">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-[0.6rem] uppercase tracking-[0.12em] text-mist/70">
                      <th className="pb-2 font-medium">Modelo</th>
                      <th className="pb-2 text-right font-medium">Casa</th>
                      <th className="pb-2 text-right font-medium">Empate</th>
                      <th className="pb-2 text-right font-medium">Fora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meta.models.map((item) => {
                      const row = fixture.probs[item.key];
                      const selected = model === item.key;
                      return (
                        <tr
                          key={item.key}
                          className={`border-b border-white/[0.04] last:border-0 ${
                            selected ? "bg-mint-400/[0.06]" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              onClick={() => setModel(item.key)}
                              className={`flex items-center gap-2 text-left ${
                                selected ? "text-chalk" : "text-mist hover:text-chalk"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  selected ? "bg-mint-400" : "bg-white/20"
                                }`}
                              />
                              {item.label}
                            </button>
                          </td>
                          {row.map((value, index) => (
                            <td
                              key={index}
                              className={`num py-2.5 text-right ${
                                Math.abs(value - bestByColumn[index]) < 1e-9
                                  ? "font-medium text-mint-300"
                                  : "text-mist"
                              }`}
                            >
                              {pct(value, 1)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[0.65rem] leading-relaxed text-mist/60">
                Em verde, a maior probabilidade de cada coluna. Não existe “modelo certo”: o
                walk-forward mostra qual deles generaliza melhor.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.14} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-medium text-chalk">Matriz de placares</h3>
                  <p className="mt-1 text-[0.72rem] text-mist">
                    Probabilidade de cada placar, em % · {fixture.home} × {fixture.away}
                  </p>
                </div>
                <span className="chip !text-[0.6rem]">Poisson</span>
              </div>
              <div className="mt-5">
                <ScoreMatrix fixture={fixture} />
              </div>
            </div>
          </Reveal>
        </div>

        <p className="mt-5 text-center text-[0.65rem] leading-relaxed text-mist/50">
          As probabilidades refletem o estado dos times na data de referência ({longDate(fixture.date)}).
          O modelo não sabe de lesões, mudanças de técnico ou decisões judiciais.
        </p>
      </div>
    </section>
  );
}

