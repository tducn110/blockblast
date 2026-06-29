import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import type { FeedbackItem } from "@/features/blockblast/hooks/useBlockBlastGame";

interface SlashScoreOverlayProps {
  items: FeedbackItem[];
}

const DISPLAY_TYPES = new Set<FeedbackItem["type"]>(["combo", "boom"]);
const COMBO_PALETTE = [
  { fill: "#f0b840", stroke: "#b85a22", slash: "#e87432", glow: "rgba(232,116,50,0.5)" },
  { fill: "#6fbf5f", stroke: "#3f7f38", slash: "#9bd66f", glow: "rgba(111,191,95,0.45)" },
  { fill: "#55b8d9", stroke: "#2a7692", slash: "#8de1ef", glow: "rgba(85,184,217,0.46)" },
  { fill: "#e979a8", stroke: "#a9416d", slash: "#ffb0cf", glow: "rgba(233,121,168,0.45)" },
  { fill: "#c891e8", stroke: "#7c4ca2", slash: "#dec0ff", glow: "rgba(200,145,232,0.44)" },
  { fill: "#f58b52", stroke: "#a94b25", slash: "#ffd16b", glow: "rgba(245,139,82,0.45)" },
];

function colorIndexForId(id: string): number {
  let total = 0;
  for (let i = 0; i < id.length; i += 1) {
    total = (total + id.charCodeAt(i) * (i + 3)) % COMBO_PALETTE.length;
  }
  return total;
}

export function SlashScoreOverlay({ items }: SlashScoreOverlayProps) {
  const visibleItems = useMemo(
    () => items.filter((item) => DISPLAY_TYPES.has(item.type)).slice(-3),
    [items]
  );
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (nodes.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      gsap.set(nodes, { opacity: 1, scale: 1, rotate: 0, y: 0 });
      return;
    }

    const context = gsap.context(() => {
      nodes.forEach((node, index) => {
        const slashLine = node.querySelector("[data-slash-line]");
        const isBoom = node.dataset.feedbackType === "boom";
        const rotate = isBoom ? 0 : index % 2 === 0 ? -5 : 5;

        gsap
          .timeline()
          .fromTo(
            node,
            { opacity: 0, scale: 0.58, y: 30, rotate: rotate * 1.5 },
            {
              opacity: 1,
              scale: isBoom ? 1.06 : 1,
              y: index * -20,
              rotate,
              duration: 0.26,
              ease: "back.out(2.1)",
            }
          )
          .fromTo(
            slashLine,
            { opacity: 0, scaleX: 0 },
            { opacity: 0.82, scaleX: 1, duration: 0.18, ease: "power3.out" },
            0.02
          )
          .to(
            slashLine,
            { opacity: 0, scaleX: 1.1, duration: 0.34, ease: "power2.out" },
            0.28
          )
          .to(
            node,
            { opacity: 0, y: index * -20 - 58, scale: 1.12, duration: 0.46, ease: "power2.in" },
            0.95
          );
      });
    });

    return () => context.revert();
  }, [visibleItems]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
      {visibleItems.map((item, index) => {
        const isCombo = item.type === "combo";
        const isBoom = item.type === "boom";
        const palette = COMBO_PALETTE[colorIndexForId(item.id)];
        const offsetX = index === 0 ? 0 : index % 2 === 0 ? 46 : -42;

        return (
          <div
            key={item.id}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            data-feedback-type={item.type}
            className="absolute grid place-items-center font-['Be_Vietnam_Pro',sans-serif]"
            style={{ left: `calc(50% + ${offsetX}px)`, top: "50%" }}
          >
            <span
              data-slash-line
              className="absolute h-[6px] w-[148px] rounded-full"
              style={{
                background: isBoom
                  ? "linear-gradient(90deg, rgba(255,255,255,0), #fff6ce 18%, #f0b840 52%, rgba(255,255,255,0))"
                  : `linear-gradient(90deg, rgba(255,255,255,0), #fff6ce 12%, ${palette.slash} 54%, rgba(255,255,255,0))`,
                boxShadow: `0 0 18px ${isBoom ? "rgba(240,184,64,0.64)" : palette.glow}`,
                transform: "rotate(-18deg)",
                transformOrigin: "center",
              }}
            />
            <span
              className="relative whitespace-nowrap text-center font-black"
              style={{
                color: isBoom ? "#fff6ce" : isCombo ? palette.fill : "#ffffff",
                fontSize: isBoom ? "clamp(28px, 8vw, 56px)" : isCombo ? "clamp(22px, 6vw, 42px)" : "clamp(34px, 10vw, 72px)",
                lineHeight: 0.9,
                WebkitTextStroke: isBoom ? "1.5px #b85a22" : `1.5px ${palette.stroke}`,
                textShadow:
                  isBoom
                    ? "0 4px 0 rgba(184,90,34,0.5), 0 12px 26px rgba(232,116,50,0.28)"
                    : `0 4px 0 ${palette.glow}, 0 12px 26px ${palette.glow}`,
              }}
            >
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
