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
  peanut: "#ffb000",
  bamboo: "#00b85f",
  orange: "#ff4d2f",
  brown: "#7b3cff",
  cream: "#00a8ff",
};

export const BLOCK_BORDER_MAP: Record<string, string> = {
  peanut: "#b76400",
  bamboo: "#00723e",
  orange: "#b82218",
  brown: "#4519a8",
  cream: "#0068b8",
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

function makePiece(
  shape: { id: string; cells: Array<{ row: number; col: number }> },
  colorId: string,
  index: number,
  rand: () => number
): BlockPiece {
  return {
    id: `piece-${Date.now()}-${index}-${Math.floor(rand() * 9999)}`,
    shapeId: shape.id,
    cells: shape.cells,
    colorId,
    placed: false,
  };
}

function testPieceForShape(shape: { id: string; cells: Array<{ row: number; col: number }> }): BlockPiece {
  return {
    id: `test-${shape.id}`,
    shapeId: shape.id,
    cells: shape.cells,
    colorId: COLOR_IDS[0],
    placed: false,
  };
}

export function createPieces(seed?: number): BlockPiece[] {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random;
  const colors = [...COLOR_IDS];

  return Array.from({ length: 3 }, (_, i) => {
    const shapeIdx = Math.floor(rand() * SHAPES.length);
    const colorIdx = Math.floor(rand() * colors.length);
    const shape = SHAPES[shapeIdx];
    const colorId = colors[colorIdx];

    return makePiece(shape, colorId, i, rand);
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
  clearedCells: number;
} {
  const clearedRows = getFullRows(board);
  const clearedCols = getFullCols(board);

  if (clearedRows.length === 0 && clearedCols.length === 0) {
    return { board, clearedRows, clearedCols, clearedCount: 0, clearedCells: 0 };
  }

  const clearedCellKeys = new Set<string>();
  clearedRows.forEach((row) => {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      clearedCellKeys.add(`${row}-${col}`);
    }
  });
  clearedCols.forEach((col) => {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      clearedCellKeys.add(`${row}-${col}`);
    }
  });

  const newBoard = board.map((rowArr, r) =>
    rowArr.map((cell, c) => {
      if (clearedCellKeys.has(`${r}-${c}`)) {
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
    clearedCells: clearedCellKeys.size,
  };
}

function getPlacements(
  board: BoardGrid,
  piece: BlockPiece
): Array<{ row: number; col: number }> {
  const placements: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (canPlacePiece(board, piece, r, c)) placements.push({ row: r, col: c });
    }
  }
  return placements;
}

export function canPlaceAllInAnyOrder(board: BoardGrid, pieces: BlockPiece[]): boolean {
  if (pieces.length === 0) return true;

  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    const rest = pieces.filter((_, index) => index !== i);
    const placements = getPlacements(board, piece);

    for (const placement of placements) {
      const placedBoard = placePiece(board, piece, placement.row, placement.col);
      const { board: nextBoard } = clearLines(placedBoard);
      if (canPlaceAllInAnyOrder(nextBoard, rest)) return true;
    }
  }

  return false;
}

function shapeWeight(shape: { cells: Array<{ row: number; col: number }> }, score: number): number {
  const difficulty = Math.min(score / 3500, 1);
  const cellCount = shape.cells.length;

  if (cellCount <= 1) return 1.65 - difficulty * 0.75;
  if (cellCount === 2) return 1.35 - difficulty * 0.35;
  if (cellCount === 3) return 1.05;
  if (cellCount === 4) return 0.72 + difficulty * 0.5;
  return 0.24 + difficulty * 0.36;
}

function pickWeightedShape(
  shapes: typeof SHAPES,
  score: number,
  rand: () => number
): (typeof SHAPES)[number] {
  const total = shapes.reduce((sum, shape) => sum + shapeWeight(shape, score), 0);
  let cursor = rand() * total;

  for (const shape of shapes) {
    cursor -= shapeWeight(shape, score);
    if (cursor <= 0) return shape;
  }

  return shapes[shapes.length - 1];
}

function createEasyFallbackPieces(board: BoardGrid, rand: () => number): BlockPiece[] {
  const colors = [...COLOR_IDS];
  const easyShapes = SHAPES.filter((shape) => shape.cells.length <= 2);
  const viableShapes = easyShapes.filter((shape) =>
    getPlacements(board, testPieceForShape(shape)).length > 0
  );
  const pool = viableShapes.length > 0 ? viableShapes : [SHAPES[0]];

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const pieces = Array.from({ length: 3 }, (_, index) => {
      const shape = pool[Math.floor(rand() * pool.length)];
      const colorId = colors[Math.floor(rand() * colors.length)];
      return makePiece(shape, colorId, index, rand);
    });

    if (canPlaceAllInAnyOrder(board, pieces)) return pieces;
  }

  return Array.from({ length: 3 }, (_, index) => {
    const colorId = colors[Math.floor(rand() * colors.length)];
    return makePiece(SHAPES[0], colorId, index, rand);
  });
}

export function createSmartPieces(
  board: BoardGrid,
  score: number,
  seed?: number
): BlockPiece[] {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random;
  const colors = [...COLOR_IDS];
  const viableShapes = SHAPES.filter((shape) =>
    getPlacements(board, testPieceForShape(shape)).length > 0
  );

  if (viableShapes.length === 0) return createEasyFallbackPieces(board, rand);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const pieces = Array.from({ length: 3 }, (_, index) => {
      const shape = pickWeightedShape(viableShapes, score, rand);
      const colorId = colors[Math.floor(rand() * colors.length)];
      return makePiece(shape, colorId, index, rand);
    });

    if (canPlaceAllInAnyOrder(board, pieces)) return pieces;
  }

  return createEasyFallbackPieces(board, rand);
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

export function calculateClearScore(clearedCount: number, combo: number, clearedCells: number): number {
  if (clearedCount <= 0) return 0;

  const lineScore = clearedCount * 120;
  const cellScore = clearedCells * 5;
  const multiLineBonus = clearedCount > 1 ? (clearedCount - 1) * 80 : 0;
  const comboBonus = combo > 1 ? (combo - 1) * 60 : 0;

  return lineScore + cellScore + multiLineBonus + comboBonus;
}
