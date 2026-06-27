export const BOARD_SIZE = 8;

export interface BoardCell {
  row: number;
  col: number;
  filled: boolean;
  colorId?: string;
}

export type BoardGrid = BoardCell[][];

export interface BlockShape {
  id: string;
  name: string;
  cells: Array<{ row: number; col: number }>;
  colorId: string;
}

export interface BlockPiece {
  id: string;
  shapeId: string;
  cells: Array<{ row: number; col: number }>;
  colorId: string;
  placed: boolean;
}

export interface Placement {
  pieceId: string;
  row: number;
  col: number;
}

export const COLOR_IDS = ["peanut", "bamboo", "orange", "brown", "cream"] as const;
export type ColorId = (typeof COLOR_IDS)[number];

export const BLOCK_COLOR_MAP: Record<string, string> = {
  peanut: "#f0b840",
  bamboo: "#6b8e3d",
  orange: "#e87432",
  brown: "#8e4e22",
  cream: "#c8aa7a",
};

export const BLOCK_BORDER_MAP: Record<string, string> = {
  peanut: "#c8920c",
  bamboo: "#4c6630",
  orange: "#b85a22",
  brown: "#5a3010",
  cream: "#8e6e3a",
};

const SHAPES: Array<{ id: string; cells: Array<{ row: number; col: number }> }> = [
  { id: "single", cells: [{ row: 0, col: 0 }] },
  { id: "line2h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
  { id: "line2v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }] },
  { id: "line3h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
  { id: "line3v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }] },
  { id: "line4h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] },
  { id: "line4v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }] },
  { id: "square2", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
  { id: "square3", cells: [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
  ] },
  { id: "l3", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
  { id: "l4", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
  { id: "t4", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 1 }] },
  { id: "z4", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
  { id: "j4", cells: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
  { id: "s4", cells: [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function createEmptyBoard(): BoardGrid {
  return Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => ({ row: r, col: c, filled: false }))
  );
}

export function createPieces(seed?: number): BlockPiece[] {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random;
  const colors = [...COLOR_IDS];

  return Array.from({ length: 3 }, (_, i) => {
    const shapeIdx = Math.floor(rand() * SHAPES.length);
    const colorIdx = Math.floor(rand() * colors.length);
    const shape = SHAPES[shapeIdx];
    const colorId = colors[colorIdx];

    return {
      id: `piece-${Date.now()}-${i}-${Math.floor(rand() * 9999)}`,
      shapeId: shape.id,
      cells: shape.cells,
      colorId,
      placed: false,
    };
  });
}

export function canPlacePiece(
  board: BoardGrid,
  piece: BlockPiece,
  row: number,
  col: number
): boolean {
  for (const cell of piece.cells) {
    const r = row + cell.row;
    const c = col + cell.col;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c].filled) return false;
  }
  return true;
}

export function placePiece(
  board: BoardGrid,
  piece: BlockPiece,
  row: number,
  col: number
): BoardGrid {
  const newBoard = board.map((rowArr) => rowArr.map((cell) => ({ ...cell })));
  for (const cell of piece.cells) {
    const r = row + cell.row;
    const c = col + cell.col;
    newBoard[r][c] = { row: r, col: c, filled: true, colorId: piece.colorId };
  }
  return newBoard;
}

export function getFullRows(board: BoardGrid): number[] {
  const full: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((cell) => cell.filled)) full.push(r);
  }
  return full;
}

export function getFullCols(board: BoardGrid): number[] {
  const full: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    if (board.every((row) => row[c].filled)) full.push(c);
  }
  return full;
}

export function clearLines(board: BoardGrid): {
  board: BoardGrid;
  clearedRows: number[];
  clearedCols: number[];
  clearedCount: number;
} {
  const clearedRows = getFullRows(board);
  const clearedCols = getFullCols(board);

  if (clearedRows.length === 0 && clearedCols.length === 0) {
    return { board, clearedRows, clearedCols, clearedCount: 0 };
  }

  const newBoard = board.map((rowArr, r) =>
    rowArr.map((cell, c) => {
      if (clearedRows.includes(r) || clearedCols.includes(c)) {
        return { row: r, col: c, filled: false, colorId: undefined };
      }
      return { ...cell };
    })
  );

  return {
    board: newBoard,
    clearedRows,
    clearedCols,
    clearedCount: clearedRows.length + clearedCols.length,
  };
}

export function canPlaceAnyPiece(board: BoardGrid, pieces: BlockPiece[]): boolean {
  const unplaced = pieces.filter((p) => !p.placed);
  for (const piece of unplaced) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlacePiece(board, piece, r, c)) return true;
      }
    }
  }
  return false;
}

export function isGameOver(board: BoardGrid, pieces: BlockPiece[]): boolean {
  return !canPlaceAnyPiece(board, pieces);
}

export function calculatePlacementScore(piece: BlockPiece): number {
  return piece.cells.length * 10;
}

export function calculateClearScore(clearedCount: number, combo: number): number {
  return clearedCount * 100 + combo * 50;
}
