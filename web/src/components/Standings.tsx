import { Crown, ShieldAlert, Trophy } from "lucide-react";
import { useState } from "react";
import type { SimRow, Standing } from "../lib/types";
import { decimal, pct } from "../lib/format";
import { teamAbbr, teamColors } from "../lib/teams";
import { SectionHeader } from "./ui/SectionHeader";
import { Reveal } from "./ui/Reveal";

type MetricKey = "prob_title" | "prob_top4" | "prob_relegation";

const metricConfig = {
  prob_title: {
    label: "Título",
    long: "chance de título",
    bar: "bg-gradient-to-r from-lime-300 to-mint-300",
    text: "text-lime-300",
  },
  prob_top4: {
    label: "G4",
    long: "chance de G4",
    bar: "bg-gradient-to-r from-mint-400 to-teal-400",
    text: "text-mint-300",
  },
  prob_relegation: {
    label: "Z4",
    long: "risco de queda",
    bar: "bg-gradient-to-r from-rose-400 to-rose-600",
    text: "text-rose-300",
  },
} as const;

function TeamDot({ team }: { team: string }) {
  const [from, to] = teamColors(team);
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 font-display text-[0.48rem] font-semibold text-white"
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {teamAbbr(team)}
    </span>
  );
}

export function Standings({
  simulation,
  standings,
}: {
  simulation: SimRow[];
  standings: Standing[];
}) {
  const [metric, setMetric] = useState<MetricKey>("prob_title");
  const config = metricConfig[metric];
  const byTeam = new Map(standings.map((row) => [row.team, row]));

  const titleLeader = [...simulation].sort((a, b) => b.prob_title - a.prob_title)[0];
  const top4Leader = [...simulation].sort((a, b) => b.prob_top4 - a.prob_top4)[0];
  const dropLeader = [...simulation].sort((a, b) => b.prob_relegation - a.prob_relegation)[0];
  const pointsLeader = [...simulation].sort((a, b) => b.points_mean - a.points_mean)[0];

  const cards = [
    {
      icon: Trophy,
      label: "Favorito ao título",
      team: titleLeader.team,
      value: pct(titleLeader.prob_title),
      detail: `${decimal(titleLeader.points_mean, 1)} pts projetados`,
      color: "text-lime-300",
    },
    {
      icon: Crown,
      label: "Quase no G4",
      team: top4Leader.team,
      value: pct(top4Leader.prob_top4),
      detail: `${top4Leader.position_now}º hoje · ${decimal(top4Leader.position_mean, 1)}º projetado`,
      color: "text-mint-300",
    },
    {
      icon: ShieldAlert,
      label: "Maior risco de queda",
      team: dropLeader.team,
      value: pct(dropLeader.prob_relegation),
      detail: `${dropLeader.points_now} pts · ${decimal(dropLeader.position_mean, 1)}º projetado`,
      color: "text-rose-300",
    },
  ];

  return (
    <section id="tabela" className="relative border-t border-white/[0.05] py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          eyebrow="Tabela projetada · Monte Carlo"
          title={
            <>
              O campeonato,
              <br />
              <span className="text-gradient">em 10 mil cenários.</span>
            </>
          }
          description="Os 53 jogos restantes são simulados 10.000 vezes com o modelo de gols. Cada cenário tem tabela, desempate por saldo e gols pró — e o resultado é uma distribuição, não uma certeza."
          aside={
            <div className="flex rounded-full border border-white/[0.08] bg-black/20 p-1">
              {(Object.keys(metricConfig) as MetricKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  aria-pressed={metric === key}
                  className={`rounded-full px-3.5 py-1.5 text-[0.72rem] font-medium transition-colors ${
                    metric === key ? "bg-white/[0.08] text-chalk" : "text-mist hover:text-chalk"
                  }`}
                >
                  {metricConfig[key].label}
                </button>
              ))}
            </div>
          }
        />

        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.label} delay={index * 0.06}>
              <div className="panel panel-hover h-full rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.14em] text-mist/70">
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                  {card.label}
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-[1.05rem] font-medium text-chalk">
                      {card.team}
                    </div>
                    <div className="mt-1 truncate text-[0.66rem] text-mist">{card.detail}</div>
                  </div>
                  <div className={`num shrink-0 text-xl font-medium ${card.color}`}>{card.value}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12} className="mt-5">
          <div className="panel overflow-hidden rounded-[1.6rem]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 md:px-6">
              <div className="flex items-center gap-2 text-[0.7rem] text-mist">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                Classificação projetada
                <span className="text-mist/40">·</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em]">
                  barra = {config.long}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[0.6rem] text-mist/60">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-mint-400/70" /> G4
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-rose-400/70" /> Z4
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[0.8rem]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[0.57rem] uppercase tracking-[0.13em] text-mist/60">
                    <th className="py-2.5 pl-4 pr-2 font-medium md:pl-6">#</th>
                    <th className="py-2.5 pr-3 font-medium">Time</th>
                    <th className="px-2 py-2.5 text-center font-medium">J</th>
                    <th className="px-2 py-2.5 text-right font-medium">Pts</th>
                    <th className="px-3 py-2.5 font-medium">Projeção de pontos</th>
                    <th className="px-3 py-2.5 font-medium">{config.label}</th>
                    <th className="py-2.5 pl-2 pr-4 text-right font-medium md:pr-6">Elo</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.map((row) => {
                    const standing = byTeam.get(row.team);
                    const isTop4 = row.position_now <= 4;
                    const isBottom4 = row.position_now >= 17;
                    const highlighted = row.team === pointsLeader.team;
                    const range = `${number(row.points_p5)}–${number(row.points_p95)}`;
                    return (
                      <tr
                        key={row.team}
                        className={`group border-b border-white/[0.035] transition-colors last:border-0 hover:bg-white/[0.025] ${
                          highlighted ? "bg-white/[0.018]" : ""
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-2 md:pl-6">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-6 w-1 rounded-full ${
                                isTop4 ? "bg-mint-400/80" : isBottom4 ? "bg-rose-400/80" : "bg-transparent"
                              }`}
                            />
                            <span className="num text-[0.78rem] text-chalk">{row.position_now}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <TeamDot team={row.team} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-medium text-chalk">{row.team}</span>
                                {standing?.promoted ? (
                                  <span className="rounded border border-amber-300/25 bg-amber-300/10 px-1 py-px text-[0.48rem] uppercase tracking-wider text-amber-200/80">
                                    acesso
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[0.58rem] text-mist/60">
                                {decimal(row.position_mean, 1)}º na média
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="num px-2 py-2.5 text-center text-mist">{standing?.played ?? "—"}</td>
                        <td className="num px-2 py-2.5 text-right text-chalk">{row.points_now}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="min-w-[74px]">
                              <div className="num text-[0.78rem] text-chalk">
                                {decimal(row.points_mean, 1)}
                                <span className="ml-1 text-[0.58rem] text-mist/60">pts</span>
                              </div>
                              <div className="text-[0.55rem] text-mist/50">faixa {range}</div>
                            </div>
                            <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                              <div
                                className="h-full rounded-full bg-white/25"
                                style={{ width: `${Math.min(100, (row.points_mean / 95) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className={`h-full rounded-full transition-[width] duration-700 ${config.bar}`}
                                style={{ width: `${row[metric] * 100}%` }}
                              />
                            </div>
                            <span className={`num w-12 text-right text-[0.72rem] ${config.text}`}>
                              {pct(row[metric], 1)}
                            </span>
                          </div>
                        </td>
                        <td className="num py-2.5 pl-2 pr-4 text-right text-[0.72rem] text-mist md:pr-6">
                          {standing ? decimal(standing.elo, 0) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 text-[0.62rem] text-mist/55 md:px-6">
              <span>
                Média de 10.000 simulações por time · faixa = intervalo P5–P95
              </span>
              <span className="inline-flex items-center gap-1.5">
                Desempate por saldo de gols e gols pró
                <span className="text-mist/30">·</span>
                {simulation.length} times
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function number(value: number): string {
  return Math.round(value).toString();
}
