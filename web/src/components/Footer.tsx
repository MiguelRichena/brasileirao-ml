import { ArrowUp } from "lucide-react";
import type { Meta } from "../lib/types";
import { longDate } from "../lib/format";

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.82 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12v3.14c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function Footer({ meta }: { meta: Meta }) {
  const links = [
    { href: "#simulador", label: "Simulador" },
    { href: "#tabela", label: "Tabela projetada" },
    { href: "#desempenho", label: "Desempenho" },
    { href: "#times", label: "Times" },
    { href: "#metodo", label: "Método" },
  ];

  return (
    <footer className="relative border-t border-white/[0.06] pb-8 pt-14">
      <div className="container-page">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-mint-400/25 bg-mint-400/[0.08]">
                <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
                  <circle cx="16" cy="16" r="11" fill="none" stroke="#6ee7b7" strokeWidth="1.6" />
                  <path d="M16 5v22M5 16h22" stroke="#6ee7b7" strokeWidth="1.2" opacity="0.8" />
                  <circle cx="16" cy="16" r="3" fill="#bef264" />
                </svg>
              </span>
              <span className="font-display text-sm font-semibold tracking-tight text-chalk">
                Brasileirão<span className="text-mint-300">.ml</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[0.74rem] leading-relaxed text-mist">
              Projeto de portfólio de machine learning aplicado ao futebol. Probabilidades
              honestas, validação sem vazamento e um benchmark que não foi escolhido a dedo.
            </p>
            <p className="mt-4 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-mist/50">
              Dados até {longDate(meta.lastMatch)} · modelo treinado em {longDate(meta.trainedOn)}
            </p>
          </div>

          <div>
            <h4 className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/60">Navegar</h4>
            <ul className="mt-3 space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[0.75rem] text-mist transition-colors hover:text-chalk"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mist/60">Projeto</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href="https://github.com/MiguelRichena/brasileirao-ml"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[0.75rem] text-mist transition-colors hover:text-chalk"
                >
                  <GithubMark /> Repositório
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/MiguelRichena/brasileirao-ml#metodologia"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.75rem] text-mist transition-colors hover:text-chalk"
                >
                  README e metodologia
                </a>
              </li>
              <li>
                <a
                  href="https://www.football-data.co.uk/brazil.php"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.75rem] text-mist transition-colors hover:text-chalk"
                >
                  Fonte dos dados
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.62rem] leading-relaxed text-mist/50">
            Feito por Miguel Richena · {meta.season} · Este é um exercício de modelagem, não uma
            recomendação de aposta.
          </p>
          <a
            href="#topo"
            className="group inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 px-3 py-1.5 text-[0.62rem] text-mist transition-colors hover:border-mint-400/30 hover:text-chalk sm:self-auto"
          >
            Voltar ao topo
            <ArrowUp className="h-3 w-3 transition-transform group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
