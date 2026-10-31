import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

const links = [
  { href: "#simulador", label: "Simulador" },
  { href: "#tabela", label: "Tabela" },
  { href: "#desempenho", label: "Desempenho" },
  { href: "#times", label: "Times" },
  { href: "#metodo", label: "Método" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? "border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="container-page flex h-16 items-center justify-between md:h-[72px]">
          <a href="#topo" className="group flex items-center gap-3" aria-label="Brasileirão ML — início">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-mint-400/25 bg-mint-400/[0.08]">
              <svg viewBox="0 0 32 32" className="h-[18px] w-[18px]" aria-hidden="true">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#6ee7b7" strokeWidth="1.6" />
                <path d="M16 5v22M5 16h22" stroke="#6ee7b7" strokeWidth="1.2" opacity="0.8" />
                <circle cx="16" cy="16" r="3" fill="#bef264" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-[0.95rem] font-semibold tracking-tight text-chalk">
                Brasileirão<span className="text-mint-300">.ml</span>
              </span>
              <span className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-mist/70">
                previsão & simulação
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[0.82rem] font-medium text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/MiguelRichena/brasileirao-ml"
              target="_blank"
              rel="noreferrer"
              className="group hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[0.8rem] font-medium text-chalk transition-colors hover:border-mint-400/40 hover:bg-mint-400/[0.08] sm:inline-flex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.82 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12v3.14c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
              </svg>
              Código
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-chalk lg:hidden"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
        <motion.div
          style={{ scaleX: progress }}
          className="h-px origin-left bg-gradient-to-r from-mint-400 via-lime-300 to-teal-300"
        />
      </div>

      {open ? (
        <div className="border-b border-white/[0.07] bg-ink/95 backdrop-blur-xl lg:hidden">
          <nav className="container-page grid gap-1 py-4" aria-label="Seções (mobile)">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-mist hover:bg-white/[0.04] hover:text-chalk"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/MiguelRichena/brasileirao-ml"
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm text-chalk"
            >
              Ver código no GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
