import { ArrowDown, ArrowRight, CircleDot, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { AppData, Fixture, Meta, SimRow } from "../lib/types";
import { decimal, longDate, pct } from "../lib/format";
import { teamAbbr, teamColors } from "../lib/teams";

function TeamBadge({ team, size = "md" }: { team: string; size?: "sm" | "md" | "lg" }) {
  const [from, to] = teamColors(team);
  const sizes = {
    sm: "h-9 w-9 text-[0.6rem]",
    md: "h-14 w-14 text-[0.8rem]",
    lg: "h-[4.5rem] w-[4.5rem] text-[1rem]",
  };
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-2xl border border-white/15 font-display font-semibold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${sizes[size]}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">{teamAbbr(team)}</span>
    </span>
  );
}

function HeroCard({
  fixture,
  leader,
}: {
  fixture: Fixture;
  leader: SimRow;
}) {
  const probs = fixture.probs.blend;
  const segments = [
    { key: "home", label: fixture.home, value: probs[0], color: "bg-mint-400" },
    { key: "draw", label: "Empate", value: probs[1], color: "bg-slate-400" },
    { key: "away", label: fixture.away, value: probs[2], color: "bg-teal-600" },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.4rem] bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.16),transparent_65%)] blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="panel relative overflow-hidden rounded-[1.8rem] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] md:p-7"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint-300/50 to-transparent" />

        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-mist">
            Confronto · modelo blend
          </span>
          <span className="chip !py-1 !text-[0.62rem]">
            <CircleDot className="h-2.5 w-2.5 text-mint-300" />
            Rodada {fixture.matchday}
          </span>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <TeamBadge team={fixture.home} size="lg" />
            <span className="max-w-[7.5rem] truncate font-display text-[0.95rem] font-medium text-chalk">
              {fixture.home}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 pb-7 text-mist/50">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.22em]">vs</span>
            <span className="h-px w-10 bg-white/10" />
          </div>
          <div className="flex min-w-0 flex-col items-end gap-2 text-right">
            <TeamBadge team={fixture.away} size="lg" />
            <span className="max-w-[7.5rem] truncate font-display text-[0.95rem] font-medium text-chalk">
              {fixture.away}
            </span>
          </div>
        </div>

        <div className="mt-7 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          {segments.map((segment) => (
            <motion.span
              key={segment.key}
              className={`${segment.color} first:rounded-l-full last:rounded-r-full`}
              initial={{ width: 0 }}
              animate={{ width: `${segment.value * 100}%` }}
              transition={{ duration: 1, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {segments.map((segment, index) => (
            <div
              key={segment.key}
              className={index === 1 ? "text-center" : index === 0 ? "text-left" : "text-right"}
            >
              <div className="num text-[1.35rem] font-medium text-chalk">{pct(segment.value, 1)}</div>
              <div className="truncate text-[0.68rem] text-mist">{segment.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-5">
          <div>
            <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/70">
              Gols esperados
            </div>
            <div className="num mt-1 text-[0.95rem] text-chalk">
              {decimal(fixture.xg[0])} <span className="text-mist/50">×</span>{" "}
              {decimal(fixture.xg[1])}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/70">
              Data estimada
            </div>
            <div className="mt-1 text-[0.95rem] text-chalk">{longDate(fixture.date)}</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="absolute -right-2 -top-5 hidden rounded-2xl border border-mint-400/25 bg-[#0a1512]/90 px-3.5 py-2.5 shadow-xl backdrop-blur-md sm:block"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-lime-300" />
          <span className="text-[0.68rem] text-mist">Favorito ao título</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-sm font-medium text-chalk">{leader.team}</span>
          <span className="num text-xs text-mint-300">{pct(leader.prob_title)}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        className="absolute -bottom-5 left-5 hidden items-center gap-2 rounded-full border border-white/10 bg-[#0a1512]/90 px-3.5 py-2 text-[0.68rem] text-mist shadow-xl backdrop-blur-md sm:flex"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
        </span>
        10.000 simulações Monte Carlo
      </motion.div>
    </div>
  );
}

export function Hero({ data, fixture }: { data: AppData; fixture: Fixture }) {
  const { meta, simulation, performance } = data;
  const leader = simulation[0];
  const market = performance.metrics.find((row) => row.model === "Mercado (média)");
  const model = performance.metrics.find((row) => row.model === "Blend LogReg + HGB");
  const reduce = useReducedMotion();

  const stats = [
    { value: meta.nMatches.toLocaleString("pt-BR"), label: "partidas no treino" },
    { value: String(meta.nFeatures), label: "features causais" },
    { value: `${(meta.nSims / 1000).toFixed(0)}k`, label: "cenários simulados" },
    { value: `${meta.seasons[0]}–${meta.seasons[1]}`, label: "temporadas cobertas" },
  ];

  return (
    <section id="topo" className="relative overflow-hidden pb-16 pt-28 md:pb-20 md:pt-36">
      <div className="grid-lines pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-mint-500/[0.07] blur-[120px]" />

      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 xl:gap-16">
          <div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-wrap items-center gap-2.5"
            >
              <span className="chip !border-mint-400/25 !bg-mint-400/[0.07] !text-mint-300">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                Brasileirão Série A · {meta.season}
              </span>
              <span className="chip">Projeto de portfólio</span>
            </motion.div>

            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 font-display text-[3.2rem] font-semibold leading-[0.95] tracking-[-0.045em] text-chalk sm:text-[4.1rem] lg:text-[4.6rem]"
            >
              Probabilidade,
              <br />
              <span className="text-gradient">não palpite.</span>
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-xl text-[1rem] leading-relaxed text-mist"
            >
              Um modelo de machine learning para o Brasileirão:{" "}
              <span className="text-chalk">{meta.nMatches.toLocaleString("pt-BR")} partidas</span>,
              validação walk-forward, simulação Monte Carlo do campeonato e gols esperados.
              E um benchmark incômodo:{" "}
              <span className="text-chalk">o mercado de apostas ainda é melhor.</span>
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <a
                href="#simulador"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-mint-300 to-lime-300 px-5 py-3 text-[0.85rem] font-semibold text-[#04110b] shadow-[0_10px_40px_-12px_rgba(52,211,153,0.7)] transition-transform hover:-translate-y-0.5"
              >
                Explorar o simulador
                <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </a>
              <a
                href="#desempenho"
                className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-[0.85rem] font-medium text-chalk transition-colors hover:border-white/25 hover:bg-white/[0.06]"
              >
                Ver os resultados
                <ArrowRight className="h-4 w-4 text-mist transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.72rem] text-mist/70"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mist/50" />
                Log loss do modelo {decimal(model?.log_loss ?? 0, 3)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mist/50" />
                Benchmark do mercado {decimal(market?.log_loss ?? 0, 3)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mist/50" />
                Atualizado em {longDate(meta.trainedOn)}
              </span>
            </motion.div>
          </div>

          <div className="relative lg:pl-4">
            <HeroCard fixture={fixture} leader={leader} />
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="panel mt-20 grid grid-cols-2 divide-white/[0.07] rounded-2xl md:mt-24 md:grid-cols-4 md:divide-x"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="px-5 py-5 md:px-7 md:py-6">
              <div className="num text-[1.3rem] font-medium text-chalk md:text-[1.5rem]">
                {stat.value}
              </div>
              <div className="mt-1 text-[0.7rem] text-mist">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
