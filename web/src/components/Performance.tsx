import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleAlert,
  Gauge,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppData } from "../lib/types";
import { decimal, featureLabels, pct, signed } from "../lib/format";
import { SectionHeader } from "./ui/SectionHeader";
import { Reveal } from "./ui/Reveal";

const SERIES = [
  { key: "market", full: "Mercado (média)", label: "Mercado", color: "#93c5fd" },
  { key: "blend", full: "Blend LogReg + HGB", label: "Blend", color: "#6ee7b7" },
  { key: "logreg", full: "LogReg", label: "LogReg", color: "#fbbf24" },
  { key: "poisson", full: "Poisson (gols)", label: "Poisson", color: "#f472b6" },
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/12 bg-[#09120f]/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
      {label !== undefined ? (
        <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-mist/70">
          {label}
        </p>
      ) : null}
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={item.name ?? item.dataKey} className="flex items-center gap-3 text-[0.72rem]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color ?? item.fill }} />
            <span className="text-mist">{item.name}</span>
            <span className="num ml-auto text-chalk">
              {typeof item.value === "number" ? decimal(item.value, 3) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function axisProps() {
  return {
    stroke: "rgba(255,255,255,0.08)",
    tick: { fill: "#93a8a0", fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
    tickLine: false,
  } as const;
}

function LogLossChart({ data }: { data: AppData["performance"]["seasons"] }) {
  const chartData = useMemo(() => {
    const bySeason = new Map<number, Record<string, number | string>>();
    for (const row of data) {
      const series = SERIES.find((item) => item.full === row.model);
      if (!series) continue;
      const entry = bySeason.get(row.season) ?? { season: row.season };
      entry[series.key] = row.log_loss;
      bySeason.set(row.season, entry);
    }
    return [...bySeason.values()].sort((a, b) => Number(a.season) - Number(b.season));
  }, [data]);

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
          <XAxis dataKey="season" {...axisProps()} />
          <YAxis
            {...axisProps()}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => value.toFixed(2)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={series.key === "blend" ? 2.4 : 1.4}
              strokeOpacity={series.key === "market" || series.key === "blend" ? 1 : 0.55}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CalibrationChart({ data }: { data: AppData["calibration"] }) {
  const modelPoints = data.model.map((bin) => ({ x: bin.p_mean, y: bin.freq, n: bin.n }));
  const marketPoints = data.market.map((bin) => ({ x: bin.p_mean, y: bin.freq, n: bin.n }));

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.055)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 0.9]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8]}
            {...axisProps()}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 0.9]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8]}
            {...axisProps()}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 0.9, y: 0.9 }]} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 5" />
          <Scatter name="Blend" data={modelPoints} fill="#6ee7b7" line={{ stroke: "#6ee7b7", strokeWidth: 1.6 }} shape="circle" />
          <Scatter name="Mercado" data={marketPoints} fill="#93c5fd" line={{ stroke: "#93c5fd", strokeWidth: 1.4 }} shape="circle" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function ImportanceChart({ rows }: { rows: AppData["performance"]["importance"] }) {
  const data = useMemo(
    () =>
      [...rows]
        .filter((row) => row.importance > 0)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map((row) => ({
          ...row,
          label: featureLabels[row.feature] ?? row.feature,
        }))
        .reverse(),
    [rows],
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 26, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            {...axisProps()}
            tickFormatter={(value: number) => value.toFixed(2)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={142}
            {...axisProps()}
            tick={{ fill: "#93a8a0", fontSize: 9.5 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="importance" name="Importância" radius={[0, 4, 4, 0]} barSize={13}>
            {data.map((entry, index) => (
              <Cell
                key={entry.feature}
                fill={index === data.length - 1 ? "#bef264" : "rgba(52,211,153,0.55)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConfusionMatrix({ data }: { data: AppData["confusion"] }) {
  const labels = ["Casa", "Empate", "Fora"];
  const max = Math.max(...data.matrix.flat());
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 text-[0.58rem]">
        <span />
        {labels.map((label) => (
          <span key={label} className="pb-1 text-center text-mist/60">
            {label}
          </span>
        ))}
        {data.matrix.map((row, rowIndex) => {
          const total = row.reduce((a, b) => a + b, 0);
          return (
            <div key={labels[rowIndex]} className="contents">
              <span className="flex items-center pr-1 text-mist/60">{labels[rowIndex]}</span>
              {row.map((value, colIndex) => {
                const share = value / total;
                const intensity = value / max;
                const correct = rowIndex === colIndex;
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`rounded-lg border px-1 py-2.5 text-center ${
                      correct ? "border-mint-400/40" : "border-white/[0.05]"
                    }`}
                    style={{ backgroundColor: `rgba(52, 211, 153, ${0.04 + intensity * 0.55})` }}
                  >
                    <div className="num text-[0.72rem] text-chalk">{pct(share, 0)}</div>
                    <div className="mt-0.5 font-mono text-[0.48rem] text-mist/60">{value}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[0.6rem] leading-relaxed text-mist/55">
        Linhas = resultado real; colunas = previsão do blend. O empate é o grande ponto cego: o
        modelo quase sempre escolhe casa ou fora.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "good" | "bad" | "muted";
  icon: typeof Gauge;
}) {
  const toneClass = {
    neutral: "text-chalk",
    good: "text-mint-300",
    bad: "text-rose-300",
    muted: "text-mist",
  }[tone];
  return (
    <div className="panel panel-hover h-full rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.13em] text-mist/65">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`num mt-3 text-[1.5rem] font-medium leading-none ${toneClass}`}>{value}</div>
      <div className="mt-2 text-[0.63rem] leading-snug text-mist">{hint}</div>
    </div>
  );
}

export function Performance({ data }: { data: AppData }) {
  const { performance, backtest, calibration, confusion } = data;
  const market = data.performance.metrics.find((row) => row.model === "Mercado (média)");
  const blend = data.performance.metrics.find((row) => row.model === "Blend LogReg + HGB");
  const delta = (blend?.log_loss ?? 0) - (market?.log_loss ?? 0);
  const boot = backtest.bootstrap[0];
  const betRows = backtest.betting.filter((row) => row.edge_minimo === 0);
  const meanBet = betRows.find((row) => row.mercado === "Média do mercado");

  return (
    <section id="desempenho" className="relative border-t border-white/[0.05] py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          eyebrow="Desempenho honesto"
          title={
            <>
              O modelo é bom.
              <br />
              <span className="text-gradient">O mercado é melhor.</span>
            </>
          }
          description="Validação walk-forward: para cada temporada, o modelo treina só com o passado e prevê a temporada inteira. O benchmark é a média das odds de fechamento, sem a margem da casa."
          aside={
            <span className="chip">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-300" />
              4.126 jogos fora da amostra
            </span>
          }
        />

        <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={Gauge}
            label="Log loss · mercado"
            value={decimal(market?.log_loss ?? 0, 3)}
            hint="Benchmark de fechamento (média das casas)."
            tone="good"
          />
          <Kpi
            icon={ChartNoAxesCombined}
            label="Log loss · blend"
            value={decimal(blend?.log_loss ?? 0, 3)}
            hint="Modelo de destaque, treinado sem vazamento."
          />
          <Kpi
            icon={TrendingDown}
            label="Diferença"
            value={signed(delta, 3)}
            hint={`IC 95%: ${signed(boot?.ic95_lo ?? 0, 3)} a ${signed(boot?.ic95_hi ?? 0, 3)}. Positivo = pior.`}
            tone="bad"
          />
          <Kpi
            icon={CircleAlert}
            label="ROI apostando"
            value={meanBet ? pct(meanBet.roi_modelo, 1) : "—"}
            hint="Stake fixo de 1 unidade, sem edge mínimo."
            tone="bad"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal delay={0.05} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-medium text-chalk">Log loss por temporada</h3>
                  <p className="mt-1 text-[0.7rem] text-mist">
                    Menor é melhor. Quanto mais perto do mercado, melhor o modelo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {SERIES.map((series) => (
                    <span key={series.key} className="inline-flex items-center gap-1.5 text-[0.62rem] text-mist">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: series.color }} />
                      {series.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <LogLossChart data={performance.seasons} />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.09} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-6">
              <h3 className="font-display text-lg font-medium text-chalk">Calibração</h3>
              <p className="mt-1 text-[0.7rem] text-mist">
                Probabilidade prevista × frequência observada (vitória do mandante).
              </p>
              <div className="mt-4">
                <CalibrationChart data={calibration} />
              </div>
              <div className="mt-1 flex items-center justify-center gap-4 text-[0.62rem] text-mist">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-300" /> Blend
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-300" /> Mercado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-px w-4 bg-white/30" /> ideal
                </span>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal delay={0.05} className="min-w-0">
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-6">
              <h3 className="font-display text-lg font-medium text-chalk">O que move o modelo</h3>
              <p className="mt-1 text-[0.7rem] text-mist">
                Permutation importance no walk-forward. Elo domina; o resto ajusta a margem.
              </p>
              <div className="mt-3">
                <ImportanceChart rows={performance.importance} />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.09} className="min-w-0">
            <div className="flex h-full flex-col gap-5">
              <div className="panel rounded-[1.6rem] p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-medium text-chalk">Matriz de confusão</h3>
                    <p className="mt-1 text-[0.7rem] text-mist">Blend · 4.126 jogos · 2016–2026</p>
                  </div>
                  <span className="chip !text-[0.58rem]">acurácia {pct(blend?.accuracy ?? 0, 1)}</span>
                </div>
                <div className="mt-4">
                  <ConfusionMatrix data={confusion} />
                </div>
              </div>

              <div className="panel rounded-[1.6rem] p-5 md:p-6">
                <h3 className="font-display text-lg font-medium text-chalk">Backtest contra o mercado</h3>
                <p className="mt-1 text-[0.7rem] text-mist">
                  Três benchmarks: média, Pinnacle e melhor preço disponível.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[380px] text-left text-[0.74rem]">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[0.55rem] uppercase tracking-[0.12em] text-mist/60">
                        <th className="pb-2 font-medium">Benchmark</th>
                        <th className="pb-2 text-right font-medium">Modelo</th>
                        <th className="pb-2 text-right font-medium">Mercado</th>
                        <th className="pb-2 text-right font-medium">Δ</th>
                        <th className="pb-2 text-right font-medium">Acurácia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtest.summary.map((row) => (
                        <tr key={row.mercado} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-2 pr-2 text-mist">{row.mercado.replace(" (fechamento)", "")}</td>
                          <td className="num py-2 text-right text-chalk">{decimal(row.modelo_log_loss, 3)}</td>
                          <td className="num py-2 text-right text-mint-300">{decimal(row.mercado_log_loss, 3)}</td>
                          <td className="num py-2 text-right text-rose-300">
                            {signed(row.modelo_log_loss - row.mercado_log_loss, 3)}
                          </td>
                          <td className="num py-2 text-right text-mist">{pct(row.modelo_acc, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[0.6rem] leading-relaxed text-mist/55">
                  A diferença é estatisticamente significativa nos três benchmarks (bootstrap
                  pareado de 2.000 reamostragens). O modelo perde por ~3 centésimos de log loss.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.05} className="mt-5">
          <div className="panel relative overflow-hidden rounded-[1.6rem] p-5 md:p-7">
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-mint-400/[0.07] blur-3xl" />
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
              <div>
                <span className="eyebrow">
                  <CircleAlert className="h-3.5 w-3.5" />
                  O achado do projeto
                </span>
                <h3 className="mt-3 font-display text-xl font-medium leading-snug text-chalk md:text-2xl">
                  O modelo parecia bom demais. Era vazamento de dados.
                </h3>
                <p className="mt-3 max-w-2xl text-[0.8rem] leading-relaxed text-mist">
                  A posição final da temporada anterior estava sendo usada na temporada corrente —
                  uma informação que não existiria no dia do jogo. Corrigido o deslocamento temporal,
                  o log loss piorou e a “vantagem” sobre o mercado desapareceu. O código de teste
                  <span className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.7rem] text-chalk">
                    test_no_leakage.py
                  </span>
                  garante que isso não volte.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="https://github.com/MiguelRichena/brasileirao-ml#o-vazamento-de-dados-que-quase-virou-resultado"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/30 bg-mint-400/[0.08] px-3.5 py-2 text-[0.7rem] font-medium text-mint-300 transition-colors hover:bg-mint-400/[0.14]"
                  >
                    Ler a narrativa completa <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="https://github.com/MiguelRichena/brasileirao-ml"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-[0.7rem] text-mist transition-colors hover:text-chalk"
                  >
                    Ver repositório
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <h4 className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/70">
                  Se tivesse apostado · stake 1
                </h4>
                <div className="mt-3 space-y-2.5">
                  {betRows.map((row) => (
                    <div key={row.mercado} className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[0.72rem] text-chalk">
                          {row.mercado.replace(" (fechamento)", "")}
                        </div>
                        <div className="text-[0.58rem] text-mist/60">
                          {row.apostas_modelo.toLocaleString("pt-BR")} apostas · odd média{" "}
                          {decimal(row.odd_media_modelo, 2)}
                        </div>
                      </div>
                      <div className="num shrink-0 text-right text-[0.8rem] text-rose-300">
                        {pct(row.roi_modelo, 1)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[0.58rem] leading-relaxed text-mist/50">
                  O placebo — apostar com as próprias probabilidades do mercado — tem ROI próximo de
                  zero. A “vantagem” do modelo era ruído.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
