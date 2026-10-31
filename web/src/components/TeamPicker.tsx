import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { teamAbbr, teamColors } from "../lib/teams";

interface TeamPickerProps {
  label: string;
  value: string;
  teams: string[];
  disabledTeam?: string;
  onChange: (team: string) => void;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function TeamPicker({ label, value, teams, disabledTeam, onChange }: TeamPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [from, to] = teamColors(value);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? teams.filter((team) => normalize(team).includes(q)) : teams;
  }, [query, teams]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  const choose = (team: string) => {
    onChange(team);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-2 block font-mono text-[0.58rem] uppercase tracking-[0.18em] text-mist/80">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-mint-400/35 hover:bg-white/[0.05]"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 font-display text-[0.62rem] font-semibold text-white"
          style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
          aria-hidden="true"
        >
          {teamAbbr(value)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[0.95rem] font-medium text-chalk">
            {value}
          </span>
          <span className="mt-0.5 block text-[0.65rem] text-mist">Selecionar time</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-mist transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={`Escolher ${label.toLowerCase()}`}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-white/12 bg-[#0a1311] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
        >
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist/60" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar time…"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2 pl-9 pr-3 text-[0.8rem] text-chalk placeholder:text-mist/50 focus:border-mint-400/40 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {filtered.map((team) => {
              const [teamFrom, teamTo] = teamColors(team);
              const isCurrent = team === value;
              const isDisabled = team === disabledTeam;
              return (
                <button
                  key={team}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  disabled={isDisabled}
                  onClick={() => choose(team)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[0.82rem] transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed opacity-30"
                      : isCurrent
                        ? "bg-mint-400/10 text-chalk"
                        : "text-mist hover:bg-white/[0.05] hover:text-chalk"
                  }`}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/10 text-[0.48rem] font-semibold text-white"
                    style={{ background: `linear-gradient(145deg, ${teamFrom}, ${teamTo})` }}
                  >
                    {teamAbbr(team)}
                  </span>
                  <span className="flex-1 truncate">{team}</span>
                  {isCurrent ? <Check className="h-3.5 w-3.5 text-mint-300" /> : null}
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-[0.78rem] text-mist">Nenhum time encontrado.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
