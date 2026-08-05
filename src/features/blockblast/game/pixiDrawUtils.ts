import { Graphics, Application, Texture } from "pixi.js";
import {
  BLOCK_BORDER_MAP,
  BLOCK_COLOR_MAP,
  BOARD_SIZE,
  BlockPiece,
} from "@/features/blockblast/game/blockBlastLogic";

export const VIEW_WIDTH = 412;
export const VIEW_HEIGHT = 572;
export const BOARD_X = 12;
export const BOARD_Y = 24;
export const CELL = 45;
export const GAP = 4;
export const BOARD_PIXELS = BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;
export const TRAY_Y = BOARD_Y + BOARD_PIXELS + 32;
export const TRAY_X = 17;
export const PIECE_SLOT_WIDTH = 118;
export const PIECE_SLOT_HEIGHT = 104;
export const PIECE_SLOT_GAP = 12;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

export function colorOf(colorId?: string): number {
  return hexToNumber(BLOCK_COLOR_MAP[colorId ?? "peanut"] ?? BLOCK_COLOR_MAP.peanut);
}

function borderOf(colorId?: string): number {
  return hexToNumber(BLOCK_BORDER_MAP[colorId ?? "peanut"] ?? BLOCK_BORDER_MAP.peanut);
}

const textureCache = new Map<string, Texture>();

export function getBlockTexture(app: Application, size: number, colorId: string, alpha = 1): Texture {
  const key = `${colorId}-${size}-${alpha}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const g = new Graphics();
  const radius = Math.max(7, size * 0.2);
  const color = colorOf(colorId);
  const border = borderOf(colorId);

  g.roundRect(2, 4, size - 2, size - 1, radius)
    .fill({ color: 0x000000, alpha: 0.2 * alpha });
  g.roundRect(0, 0, size - 2, size - 2, radius)
    .fill({ color, alpha })
    .stroke({ width: 3, color: border, alpha: 1 * alpha });
  g.roundRect(5, 5, size - 13, Math.max(5, size * 0.18), radius * 0.7)
    .fill({ color: 0xffffff, alpha: 0.34 * alpha });
  g.roundRect(5, size - 11, size - 13, 4, radius * 0.5)
    .fill({ color: border, alpha: 0.28 * alpha });

  const texture = app.renderer.generateTexture(g);
  textureCache.set(key, texture);
  
  // Free the graphics object memory
  g.destroy();
  
  return texture;
}


export function cellPoint(row: number, col: number) {
  return {
    x: BOARD_X + col * (CELL + GAP),
    y: BOARD_Y + row * (CELL + GAP),
  };
}

export function pieceBounds(piece: BlockPiece) {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;

  for (const cell of piece.cells) {
    minRow = Math.min(minRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxRow = Math.max(maxRow, cell.row);
    maxCol = Math.max(maxCol, cell.col);
  }

  return {
    minRow,
    minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}
