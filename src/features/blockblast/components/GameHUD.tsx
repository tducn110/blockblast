import { useEffect, useMemo, useRef, type ReactNode } from "react";
import gsap from "gsap";
import type { FeedbackItem } from "@/features/blockblast/hooks/useBlockBlastGame";

interface GameHUDProps {
  score: number;
  bestScore: number;
  feedback: FeedbackItem[];
}

export function GameHUD({ score, bestScore, feedback }: GameHUDProps) {
  const scoreDeltaItems = useMemo(
    () => feedback.filter((item) => item.type === "placement").slice(-2),
    [feedback]
  );

  return (
    <div className="flex items-stretch justify-between w-full gap-2 px-1 lg:flex-col lg:px-0">
      <StatBox label="Điểm" value={score.toLocaleString()} accent>
        <ScoreDeltaStack items={scoreDeltaItems} />
      </StatBox>
      <StatBox label="Tốt nhất" value={bestScore.toLocaleString()} />
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
  highlight,
  children,
}: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
  children?: ReactNode;
}) {
  const labelColor = accent ? "#8e6e3a" : "#8a7d65";
  const valueColor = highlight ? "#e87432" : accent ? "#8e4e22" : "#4a4232";

  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col items-center overflow-visible rounded-[12px] p-[4px_6px] lg:items-start ${
        accent
          ? "lg:min-h-[78px] lg:justify-center lg:rounded-[16px] lg:p-[10px_12px]"
          : "lg:p-[6px_8px]"
      }`}
      style={{
        background: "rgba(253,246,234,0.85)",
        border: "1.5px solid rgba(138,125,101,0.3)",
      }}
    >
      <span
        className="text-[9px] lg:text-[10px]"
        style={{
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: labelColor,
        }}
      >
        {label}
      </span>
      <span
        className={
          accent
            ? "text-[16px] leading-[1.2] lg:text-[34px] lg:leading-[0.98] lg:tracking-[-1.2px]"
            : "text-[16px] leading-[1.2] lg:text-[20px] lg:leading-[1.05]"
        }
        style={{
          fontWeight: 800,
          color: valueColor,
          textShadow: accent ? "0 1px 0 rgba(255,250,240,0.8)" : "none",
        }}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

function ScoreDeltaStack({ items }: { items: FeedbackItem[] }) {
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (nodes.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      gsap.set(nodes, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const context = gsap.context(() => {
      nodes.forEach((node, index) => {
        gsap
          .timeline()
          .fromTo(
            node,
            { opacity: 0, y: 6, scale: 0.84 },
            { opacity: 1, y: -14 - index * 8, scale: 1, duration: 0.24, ease: "back.out(1.7)" }
          )
          .to(
            node,
            { opacity: 0, y: -30 - index * 10, scale: 1.06, duration: 0.5, ease: "power2.out" },
            0.7
          );
      });
    });

    return () => context.revert();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
      {items.map((item, index) => (
        <span
          key={item.id}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          className="absolute left-1/2 whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[13px] font-black tabular-nums"
          style={{
            transform: "translateX(-50%)",
            color: "#e87432",
            background: "rgba(253,246,234,0.94)",
            boxShadow: "0 8px 18px rgba(184,90,34,0.22)",
            textShadow: "0 1px 0 rgba(255,246,206,0.82)",
          }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}
