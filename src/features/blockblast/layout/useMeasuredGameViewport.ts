import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { VIEW_HEIGHT, VIEW_WIDTH } from "@/features/blockblast/game/pixiDrawUtils";
import { getGameLayoutMode, type GameViewport } from "@/features/blockblast/layout/gameViewport";

export function useMeasuredGameViewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeRafRef = useRef(0);
  const resizeTimersRef = useRef<number[]>([]);
  const [viewport, setViewport] = useState<GameViewport>({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  });

  const applyMeasuredSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  }, []);

  const scheduleResize = useCallback(() => {
    window.cancelAnimationFrame(resizeRafRef.current);
    resizeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resizeTimersRef.current = [];

    resizeRafRef.current = window.requestAnimationFrame(applyMeasuredSize);
    resizeTimersRef.current = [120, 320].map((delay) =>
      window.setTimeout(applyMeasuredSize, delay)
    );
  }, [applyMeasuredSize]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleResize);

    resizeObserver?.observe(container);
    scheduleResize();

    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("orientationchange", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleResize, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(resizeRafRef.current);
      resizeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      resizeTimersRef.current = [];
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("scroll", scheduleResize);
    };
  }, [scheduleResize]);

  const layoutMode = useMemo(
    () => getGameLayoutMode(viewport.width, viewport.height),
    [viewport.width, viewport.height]
  );

  return {
    containerRef,
    viewport,
    layoutMode,
  };
}
