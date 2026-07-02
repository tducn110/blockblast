import { VIEW_HEIGHT, VIEW_WIDTH } from "@/features/blockblast/game/pixiDrawUtils";

export type GameLayoutMode = "desktop" | "mobile-short" | "mobile-normal" | "mobile-tall";

export type GameWorldTransform = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GameViewport = {
  width: number;
  height: number;
};

export function getGameLayoutMode(width: number, height: number): GameLayoutMode {
  const isMobileWidth = width < 768;
  const aspect = height / Math.max(width, 1);

  if (!isMobileWidth) return "desktop";
  if (height <= 700 || aspect < 1.82) return "mobile-short";
  if (height >= 820 || aspect >= 2.05) return "mobile-tall";
  return "mobile-normal";
}

export function createGameWorldTransform(width: number, height: number): GameWorldTransform {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(safeWidth / VIEW_WIDTH, safeHeight / VIEW_HEIGHT);
  const worldWidth = VIEW_WIDTH * scale;
  const worldHeight = VIEW_HEIGHT * scale;

  return {
    scale,
    x: Math.floor((safeWidth - worldWidth) / 2),
    y: Math.floor((safeHeight - worldHeight) / 2),
    width: worldWidth,
    height: worldHeight,
  };
}

export function rendererPointToWorld(
  point: { x: number; y: number },
  transform: GameWorldTransform
) {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}
