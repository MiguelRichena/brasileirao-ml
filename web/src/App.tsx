import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { AppData } from "./lib/types";
import { loadAppData } from "./lib/data";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Simulator } from "./components/Simulator";
import { Standings } from "./components/Standings";
import { Performance } from "./components/Performance";
import { Teams } from "./components/Teams";
import { Method } from "./components/Method";
import { Footer } from "./components/Footer";

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-mint-400/25 bg-mint-400/[0.08]">
          <span className="absolute inset-0 animate-ping rounded-2xl border border-mint-400/20" />
          <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#6ee7b7" strokeWidth="1.6" />
            <path d="M16 5v22M5 16h22" stroke="#6ee7b7" strokeWidth="1.2" opacity="0.8" />
            <circle cx="16" cy="16" r="3" fill="#bef264" />
          </svg>
        </span>
        <div>
          <p className="font-display text-sm font-medium text-chalk">Carregando o campeonato</p>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-mist/60">
            380 confrontos · 10.000 simulações
          </p>
        </div>
        <LoaderCircle className="h-4 w-4 animate-spin text-mint-300/60" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="panel max-w-md rounded-2xl p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-300" />
        <h1 className="mt-3 font-display text-lg font-medium text-chalk">
          Não foi possível carregar os dados
        </h1>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-mist">{message}</p>
        <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/25 p-3 text-left font-mono text-[0.65rem] leading-relaxed text-mint-300/80">
          python scripts/export_web_data.py
          <br />
          npm run dev
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadAppData()
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Erro desconhecido.");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const initial =
    data.fixtureIndex.get("Flamengo|Palmeiras") ?? data.fixtures[0];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <a
        href="#simulador"
        className="sr-only rounded-full bg-mint-300 px-4 py-2 font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Pular para o simulador
      </a>
      <Nav />
      <main>
        <Hero data={data} fixture={initial} />
        <Simulator data={data} initial={initial} />
        <Standings simulation={data.simulation} standings={data.standings} />
        <Performance data={data} />
        <Teams teams={data.teams} standings={data.standings} />
        <Method meta={data.meta} />
      </main>
      <Footer meta={data.meta} />
    </div>
  );
}
