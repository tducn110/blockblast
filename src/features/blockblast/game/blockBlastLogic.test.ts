import { describe, it, expect } from 'vitest';
import { canPlaceAllInAnyOrder, BOARD_SIZE } from './blockBlastLogic';
import type { BoardGrid, BlockPiece } from './blockBlastLogic';

function createEmptyBoard(): BoardGrid {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => ({
      row,
      col,
      filled: false,
      colorId: undefined,
    }))
  );
}

function makeMockPiece(id: string, cells: { row: number; col: number }[]): BlockPiece {
  return { id, cells, colorId: "red", placed: false, shapeId: "test" };
}

describe('blockBlastLogic Exact Solver', () => {
  it('1. All 3 pieces can be placed directly', () => {
    const board = createEmptyBoard();
    const pieces = [
      makeMockPiece('A', [{ row: 0, col: 0 }]),
      makeMockPiece('B', [{ row: 0, col: 0 }]),
      makeMockPiece('C', [{ row: 0, col: 0 }]),
    ];
    expect(canPlaceAllInAnyOrder(board, pieces)).toBe(true);
  });

  it('2. No pieces can be placed (full board)', () => {
    const board = createEmptyBoard();
    board.forEach(r => r.forEach(c => c.filled = true));
    const pieces = [makeMockPiece('A', [{ row: 0, col: 0 }])];
    expect(canPlaceAllInAnyOrder(board, pieces)).toBe(false);
  });

  it('3. A cannot be placed directly, but B -> clears line -> A can be placed', () => {
    const board = createEmptyBoard();
    for (let c = 0; c < 7; c++) board[0][c].filled = true;
    for (let r = 1; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c].filled = true;
      }
    }
    const pieceB = makeMockPiece('B', [{ row: 0, col: 0 }]);
    const pieceA = makeMockPiece('A', [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
    expect(canPlaceAllInAnyOrder(board, [pieceA, pieceB])).toBe(true);
  });

  it('4. MRV candidate fails, but next candidate succeeds', () => {
    const board = createEmptyBoard();
    board.forEach(r => r.forEach(c => c.filled = true));
    board[0][0].filled = false;
    board[0][1].filled = false;
    board[1][0].filled = false;
    
    const pieceA = makeMockPiece('A', [{row:0, col:0}, {row:0, col:1}]);
    const pieceB = makeMockPiece('B', [{row:0, col:0}]);
    
    expect(canPlaceAllInAnyOrder(board, [pieceB, pieceA])).toBe(true);
  });
  
  it('5. Handles two identical pieces', () => {
    const board = createEmptyBoard();
    const p1 = makeMockPiece('P1', [{ row: 0, col: 0 }]);
    const p2 = makeMockPiece('P2', [{ row: 0, col: 0 }]);
    expect(canPlaceAllInAnyOrder(board, [p1, p2])).toBe(true);
  });
  
  it('6. Placement creates full row -> clear before recursion', () => {
    const board = createEmptyBoard();
    board.forEach(r => r.forEach(c => c.filled = true));
    board[0].forEach(c => c.filled = false); // Row 0 empty
    // To not clear columns, ensure at least one cell in each column is empty
    for (let c = 0; c < BOARD_SIZE; c++) {
        board[1][c].filled = false;
    }
    
    // P1 takes 7 spots in row 0
    const p1 = makeMockPiece('P1', Array.from({length: 7}, (_, i) => ({row: 0, col: i})));
    // P2 takes the last spot, clearing row 0
    const p2 = makeMockPiece('P2', [{row: 0, col: 0}]);
    // P3 requires 8 spots (a full row). Only fits if row 0 was cleared!
    const p3 = makeMockPiece('P3', Array.from({length: 8}, (_, i) => ({row: 0, col: i})));
    
    expect(canPlaceAllInAnyOrder(board, [p1, p2, p3])).toBe(true);
  });
  
  it('7. Placement creates full column -> clear before recursion', () => {
    const board = createEmptyBoard();
    board.forEach(r => r.forEach(c => c.filled = true));
    board.forEach(r => r[0].filled = false); // Col 0 empty
    // Prevent row clears
    board.forEach(r => r[1].filled = false);
    
    // P1 takes 7 spots in col 0
    const p1 = makeMockPiece('P1', Array.from({length: 7}, (_, i) => ({row: i, col: 0})));
    // P2 takes the last spot, clearing col 0
    const p2 = makeMockPiece('P2', [{row: 0, col: 0}]);
    // P3 requires a full column 0. Only fits if col 0 was cleared!
    const p3 = makeMockPiece('P3', Array.from({length: 8}, (_, i) => ({row: i, col: 0})));
    
    expect(canPlaceAllInAnyOrder(board, [p1, p2, p3])).toBe(true);
  });

  it('8. Impossible triplet returns false', () => {
    const board = createEmptyBoard();
    board.forEach(r => r.forEach(c => c.filled = true));
    board[0][0].filled = false;
    board[0][1].filled = false;
    board[1][0].filled = false;
    
    const p3x3 = makeMockPiece('P3x3', [
      {row:0,col:0}, {row:0,col:1}, {row:0,col:2},
      {row:1,col:0}, {row:1,col:1}, {row:1,col:2},
      {row:2,col:0}, {row:2,col:1}, {row:2,col:2}
    ]);
    
    expect(canPlaceAllInAnyOrder(board, [p3x3])).toBe(false);
  });
});

describe('Worst-case benchmark', () => {
  it('Should solve a highly fragmented board quickly', () => {
    const board = createEmptyBoard();
    // Create checkerboard pattern
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if ((r + c) % 2 === 0) board[r][c].filled = true;
      }
    }
    
    // 3 small pieces (1x1) have a LOT of placements (32 each).
    // Depth = 3, Placements = 32. 32 * 31 * 30 = 29,760 combinations.
    // We expect the solver to find the solution immediately (first branch).
    const pieces = [
      makeMockPiece('A', [{ row: 0, col: 0 }]),
      makeMockPiece('B', [{ row: 0, col: 0 }]),
      makeMockPiece('C', [{ row: 0, col: 0 }]),
    ];
    
    const start = performance.now();
    const result = canPlaceAllInAnyOrder(board, pieces);
    const time = performance.now() - start;
    
    expect(result).toBe(true);
    // Even in worst case, it should be fast (e.g. < 50ms)
    expect(time).toBeLessThan(50);
    console.log(`Worst-case fragmented board took: ${time.toFixed(2)}ms`);
  });
});
