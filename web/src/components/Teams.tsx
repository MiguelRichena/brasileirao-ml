import { CalendarDays, ChevronRight, MapPin, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Standing, TeamHistory } from "../lib/types";
import { decimal, longDate, monthLabel } from "../lib/format";
import { teamAbbr, teamColors } from "../lib/teams";
import { SectionHeader } from "./ui/SectionHeader";
import { Reveal } from "./ui/Reveal";

function bigBadge(team: string) {
  const [from, to] = teamColors(team);
  return (
    <span
      className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 font-display text-[1.05rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {teamAbbr(team)}
    </span>
  );
}

function smallBadge(team: string) {
  const [from, to] = teamColors(team);
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/10 font-display text-[0.44rem] font-semibold text-white"
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {teamAbbr(team)}
    </span>
  );
}

function EloTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/12 bg-[#09120f]/95 px-3 py-2 shadow-2xl">
      <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-mist/60">
        {longDate(String(label))}
      </p>
      <p className="num mt-1 text-[0.8rem] text-mint-300">{decimal(payload[0].value, 0)} Elo</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[0.55rem] uppercase tracking-[0.12em] text-mist/60">{label}</div>
      <div className="num mt-1 text-[0.95rem] text-chalk">{value}</div>
      {hint ? <div className="mt-0.5 text-[0.55rem] text-mist/55">{hint}</div> : null}
    </div>
  );
}

export function Teams({
  teams,
  standings,
}: {
  teams: TeamHistory[];
  standings: Standing[];
}) {
  const [selected, setSelected] = useState("Flamengo");
  const history = teams.find((team) => team.team === selected) ?? teams[0];
  const table = standings.find((row) => row.team === selected);

  const chartData = useMemo(
    () => history.elo.map(([date, elo]) => ({ date, elo: Number(elo.toFixed(0)) })),
    [history],
  );

  const form = table ? [...table.form].reverse() : [];
  const last5 = table ? table.form5Ppg : 0;

  return (
    <section id="times" className="relative border-t border-white/[0.05] py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          eyebrow="Explorador de times"
          title={
            <>
              Cada time,
              <br />
              <span className="text-gradient">por dentro.</span>
            </>
          }
          description="Elo, forma recente, posição e os últimos jogos. Use a lista para navegar — os dados são o estado de cada clube antes da próxima rodada."
          aside={
            <span className="chip">
              <TrendingUp className="h-3.5 w-3.5 text-mint-300" />
              Elo com regressão entre temporadas
            </span>
          }
        />

        <div className="mt-9 grid gap-5 lg:grid-cols-[240px_1fr]">
          <Reveal className="min-w-0">
            <div className="panel overflow-hidden rounded-[1.4rem] p-2">
              <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:max-h-[560px] lg:overflow-y-auto lg:pb-0 no-scrollbar">
                {teams.map((team) => {
                  const row = standings.find((item) => item.team === team.team);
                  const active = team.team === selected;
                  return (
                    <button
                      key={team.team}
                      type="button"
                      onClick={() => setSelected(team.team)}
                      className={`flex min-w-max items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[0.75rem] transition-colors lg:w-full lg:min-w-0 ${
                        active
                          ? "bg-mint-400/[0.1] text-chalk"
                          : "text-mist hover:bg-white/[0.04] hover:text-chalk"
                      }`}
                    >
                      {smallBadge(team.team)}
                      <span className="flex-1 truncate">{team.team}</span>
                      <span className="num text-[0.62rem] text-mist/50">{row?.position}º</span>
                      <ChevronRight
                        className={`hidden h-3 w-3 shrink-0 lg:block ${
                          active ? "text-mint-300" : "text-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="min-w-0">
            <div className="panel rounded-[1.6rem] p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {bigBadge(selected)}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-semibold tracking-tight text-chalk md:text-[1.8rem]">
                        {selected}
                      </h3>
                      <span className="rounded-full border border-mint-400/25 bg-mint-400/[0.08] px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-mint-300">
                        {table?.position}º lugar
                      </span>
                    </div>
                    <p className="mt-1 text-[0.72rem] text-mist">
                      {table?.points} pontos em {table?.played} jogos
                      {table?.prevPosition ? ` · ${table.prevPosition}º na temporada anterior` : ""}
                      {table?.promoted ? " · recém-promovido" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-mist/60">
                    forma
                  </span>
                  <div className="flex gap-1">
                    {form.map((result, index) => (
                      <span
                        key={`${result}-${index}`}
                        className={`form-${result} grid h-5 w-5 place-items-center rounded-md font-mono text-[0.55rem]`}
                        title={result === "V" ? "Vitória" : result === "E" ? "Empate" : "Derrota"}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Elo" value={table ? decimal(table.elo, 0) : "—"} hint="rating atual" />
                <Stat label="Pontos/jogo" value={table ? decimal(table.ppg, 2) : "—"} hint="na temporada" />
                <Stat
                  label="Saldo de gols"
                  value={table ? (table.goalDiff > 0 ? `+${table.goalDiff}` : String(table.goalDiff)) : "—"}
                  hint="gols pró − contra"
                />
                <Stat label="Forma (5)" value={decimal(last5, 2)} hint="pontos por jogo" />
                <Stat label="Gols pró (5)" value={table ? decimal(table.form5Gf, 1) : "—"} hint="por jogo" />
                <Stat label="Gols contra (5)" value={table ? decimal(table.form5Ga, 1) : "—"} hint="por jogo" />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-medium text-chalk">
                      Histórico de Elo
                      <span className="ml-2 font-sans text-[0.62rem] font-normal text-mist">
                        últimas 4 temporadas
                      </span>
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[0.58rem] text-mist/55">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                      pré-jogo
                    </span>
                  </div>
                  <div className="mt-3 h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id="elo-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="rgba(255,255,255,0.08)"
                          tickLine={false}
                          tick={{ fill: "#93a8a0", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                          tickFormatter={monthLabel}
                          minTickGap={40}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.08)"
                          tickLine={false}
                          domain={["auto", "auto"]}
                          tick={{ fill: "#93a8a0", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                          tickFormatter={(value: number) => value.toFixed(0)}
                          width={44}
                        />
                        <Tooltip content={<EloTooltip />} />
                        <ReferenceLine y={1500} stroke="rgba(255,255,255,0.16)" strokeDasharray="4 5" />
                        <Area
                          type="monotone"
                          dataKey="elo"
                          stroke="#6ee7b7"
                          strokeWidth={1.8}
                          fill="url(#elo-fill)"
                          dot={false}
                          activeDot={{ r: 3, fill: "#bef264", strokeWidth: 0 }}
                          animationDuration={900}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="flex items-center gap-1.5 font-display text-sm font-medium text-chalk">
                    Últimos 10 jogos
                  </h4>
                  <div className="mt-3 space-y-1">
                    {history.games
                      .slice()
                      .reverse()
                      .map((game, index) => (
                        <div
                          key={`${game.date}-${game.opponent}-${index}`}
                          className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[0.68rem] transition-colors hover:bg-white/[0.03]"
                        >
                          <span className="num w-[62px] shrink-0 text-[0.58rem] text-mist/50">
                            {game.date.slice(8, 10)}/{game.date.slice(5, 7)}
                          </span>
                          <span
                            className={`grid h-4 w-7 shrink-0 place-items-center rounded border font-mono text-[0.45rem] uppercase ${
                              game.home
                                ? "border-mint-400/25 bg-mint-400/[0.08] text-mint-300"
                                : "border-white/10 bg-white/[0.03] text-mist/70"
                            }`}
                            title={game.home ? "Em casa" : "Fora"}
                          >
                            {game.home ? "casa" : "fora"}
                          </span>
                          {smallBadge(game.opponent)}
                          <span className="min-w-0 flex-1 truncate text-mist">{game.opponent}</span>
                          <span className="num w-8 shrink-0 text-right text-chalk">
                            {game.goalsFor}–{game.goalsAgainst}
                          </span>
                          <span
                            className={`form-${game.result} grid h-4 w-4 shrink-0 place-items-center rounded font-mono text-[0.48rem]`}
                          >
                            {game.result}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[0.6rem] text-mist/50">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" />
                  Atualizado após {longDate(history.games[history.games.length - 1]?.date ?? "")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  Elo: K=20 · vantagem de casa 60 pts · regressão de 25%
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
