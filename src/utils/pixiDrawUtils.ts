import { Graphics } from "pixi.js";
import {
  BLOCK_BORDER_MAP,
  BLOCK_COLOR_MAP,
  BOARD_SIZE,
  BlockPiece,
} from "./blockBlastLogic";

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

export function borderOf(colorId?: string): number {
  return hexToNumber(BLOCK_BORDER_MAP[colorId ?? "peanut"] ?? BLOCK_BORDER_MAP.peanut);
}

export function drawBlock(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  colorId: string | undefined,
  alpha = 1
) {
  const radius = Math.max(7, size * 0.2);
  const color = colorOf(colorId);
  const border = borderOf(colorId);

  g.roundRect(x + 1, y + 2, size - 2, size - 2, radius)
    .fill({ color: 0x000000, alpha: 0.13 * alpha });
  g.roundRect(x, y, size - 2, size - 2, radius)
    .fill({ color, alpha })
    .stroke({ width: 2, color: border, alpha: 0.92 * alpha });
  g.roundRect(x + 5, y + 5, size - 13, Math.max(5, size * 0.18), radius * 0.7)
    .fill({ color: 0xffffff, alpha: 0.24 * alpha });
  g.roundRect(x + 5, y + size - 11, size - 13, 4, radius * 0.5)
    .fill({ color: border, alpha: 0.16 * alpha });
}

export function drawBoardBackground(g: Graphics) {
  g.roundRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 24)
    .fill({ color: 0xf5ecd7, alpha: 1 })
    .stroke({ width: 2, color: 0x8a7d65, alpha: 0.28 });

  g.moveTo(0, 132)
    .bezierCurveTo(86, 86, 148, 172, 238, 119)
    .bezierCurveTo(296, 84, 332, 98, VIEW_WIDTH, 74)
    .lineTo(VIEW_WIDTH, 0)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0xe6d8b2, alpha: 0.36 });

  g.moveTo(0, 216)
    .bezierCurveTo(86, 188, 134, 228, 216, 196)
    .bezierCurveTo(288, 168, 334, 194, VIEW_WIDTH, 162)
    .lineTo(VIEW_WIDTH, 0)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0xc8d68a, alpha: 0.22 });

  g.roundRect(BOARD_X - 8, BOARD_Y - 8, BOARD_PIXELS + 16, BOARD_PIXELS + 16, 22)
    .fill({ color: 0xefe3c4, alpha: 0.88 })
    .stroke({ width: 2, color: 0x8a7d65, alpha: 0.22 });
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
