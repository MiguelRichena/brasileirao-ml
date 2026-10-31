import {
  AlertTriangle,
  ArrowUpRight,
  Braces,
  Database,
  FlaskConical,
  GitBranch,
  Layers,
  LineChart,
  Scale,
} from "lucide-react";
import type { Meta } from "../lib/types";
import { SectionHeader } from "./ui/SectionHeader";
import { Reveal } from "./ui/Reveal";

const steps = [
  {
    icon: Database,
    step: "01",
    title: "Dados",
    text: "5.646 partidas da Série A entre 2012 e 2026, com placar e odds de fechamento. Fonte: football-data.co.uk.",
  },
  {
    icon: Braces,
    step: "02",
    title: "Features causais",
    text: "32 atributos pré-jogo: Elo, forma (5 e 10 jogos), pontos, saldo, posição, descanso e acesso. Tudo defasado com shift(1) e snapshots por data.",
  },
  {
    icon: GitBranch,
    step: "03",
    title: "Walk-forward",
    text: "Para cada temporada, treina apenas com o passado e prevê a temporada inteira. Nada de embaralhar o futuro com o presente.",
  },
  {
    icon: Scale,
    step: "04",
    title: "Benchmark",
    text: "Comparação com odds sem margem, bootstrap pareado e ROI. O mercado é o adversário — e ele é forte.",
  },
];

const specs = [
  ["Dados", "5.646 partidas · 2012–2026"],
  ["Validação", "walk-forward por temporada"],
  ["Amostra de teste", "4.126 jogos com odds"],
  ["Features", "32, todas pré-jogo"],
  ["Modelos", "LogReg, Boosting, Blend, Poisson"],
  ["Métrica principal", "log loss (Brier e RPS de apoio)"],
  ["Simulação", "10.000 cenários Monte Carlo"],
];

const limitations = [
  "Não sabe de lesões, suspensões, troca de técnico, viagens ou decisões judiciais.",
  "Não bate o mercado de forma consistente — e o projeto diz isso com todas as letras.",
  "A simulação congela as forças Poisson estimadas; não recalcula o modelo a cada cenário.",
  "2026 não tem Pinnacle na base; o benchmark principal usa a média do mercado.",
  "Odds de fechamento não existem para todas as partidas, então o n de cada teste varia.",
];

export function Method({ meta }: { meta: Meta }) {
  return (
    <section id="metodo" className="relative border-t border-white/[0.05] py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          eyebrow="Metodologia"
          title={
            <>
              Nada de mágica.
              <br />
              <span className="text-gradient">Só disciplina.</span>
            </>
          }
          description="Um modelo só vale o que vale a validação. O pipeline inteiro foi desenhado para impedir que informação do futuro contamine o treino — inclusive um teste automático que falha se isso acontecer."
          aside={
            <span className="chip">
              <FlaskConical className="h-3.5 w-3.5 text-mint-300" />
              Pipeline reprodutível
            </span>
          }
        />

        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.05}>
              <div className="panel panel-hover relative h-full overflow-hidden rounded-2xl p-5">
                <span className="pointer-events-none absolute -right-1 -top-3 font-display text-[3.7rem] font-semibold leading-none text-white/[0.045]">
                  {item.step}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-mint-400/25 bg-mint-400/[0.08]">
                  <item.icon className="h-4 w-4 text-mint-300" />
                </div>
                <h3 className="mt-4 font-display text-[0.98rem] font-medium text-chalk">{item.title}</h3>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-mist">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal delay={0.05}>
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-mint-300" />
                <h3 className="font-display text-lg font-medium text-chalk">Ficha técnica</h3>
              </div>
              <dl className="mt-4 divide-y divide-white/[0.055]">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-[0.68rem] text-mist/70">{label}</dt>
                    <dd className="text-right text-[0.72rem] text-chalk">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["Python", "scikit-learn", "pandas", "Streamlit", "React", "TypeScript", "Tailwind", "Vite"].map(
                  (tool) => (
                    <span key={tool} className="chip !py-1 !text-[0.6rem]">
                      {tool}
                    </span>
                  ),
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.09}>
            <div className="panel h-full rounded-[1.6rem] p-5 md:p-7">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <h3 className="font-display text-lg font-medium text-chalk">Limitações, sem letra miúda</h3>
              </div>
              <ul className="mt-4 space-y-2.5">
                {limitations.map((limitation) => (
                  <li key={limitation} className="flex gap-2.5 text-[0.73rem] leading-relaxed text-mist">
                    <span className="mt-[0.42rem] h-1 w-1 shrink-0 rounded-full bg-amber-300/60" />
                    {limitation}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/25 p-3.5">
                <div className="flex items-center gap-2 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-mist/60">
                  <LineChart className="h-3 w-3" />
                  Pipeline
                </div>
                <pre className="mt-2 overflow-x-auto font-mono text-[0.62rem] leading-relaxed text-mint-300/85">
{`python scripts/download_data.py
python scripts/train.py
python scripts/backtest.py
python scripts/export_web_data.py
npm --prefix web run build`}
                </pre>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.05} className="mt-5">
          <div className="relative overflow-hidden rounded-[1.6rem] border border-mint-400/20 bg-gradient-to-br from-mint-400/[0.09] via-ink-2 to-ink p-6 md:p-9">
            <div className="pointer-events-none absolute -left-10 bottom-0 h-52 w-52 rounded-full bg-mint-400/10 blur-3xl" />
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-mint-300/80">
                  Código aberto
                </span>
                <h3 className="mt-3 font-display text-xl font-medium leading-snug text-chalk md:text-2xl">
                  Cada número desta página sai de um script que você pode rodar.
                </h3>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-mist">
                  Dados, features, treino, backtest, testes de vazamento e exportação do site.
                  Tudo versionado, com {meta.nMatches.toLocaleString("pt-BR")} partidas e nenhum
                  resultado inventado.
                </p>
              </div>
              <a
                href="https://github.com/MiguelRichena/brasileirao-ml"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-mint-300 to-lime-300 px-5 py-3 text-[0.8rem] font-semibold text-[#04110b] transition-transform hover:-translate-y-0.5"
              >
                Abrir no GitHub
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
