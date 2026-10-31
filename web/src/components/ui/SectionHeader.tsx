import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, aside }: SectionHeaderProps) {
  return (
    <Reveal>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            {eyebrow}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-chalk md:text-[2.9rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-mist">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </Reveal>
  );
}
