import { describe, it, expect } from 'vitest';
import {
  createSmartPieces,
  createEmptyBoard,
  BOARD_SIZE,
  canPlaceAllInAnyOrder,
  BoardGrid
} from './blockBlastLogic';

describe('createSmartPieces', () => {
  it('returns exactly 3 pieces', () => {
    const board = createEmptyBoard();
    const pieces = createSmartPieces(board, 0);
    expect(pieces.length).toBe(3);
  });

  it('returns pieces with valid ids, cells, and colors', () => {
    const board = createEmptyBoard();
    const pieces = createSmartPieces(board, 0);
    
    for (const piece of pieces) {
      expect(typeof piece.id).toBe('string');
      expect(typeof piece.colorId).toBe('string');
      expect(['peanut', 'bamboo', 'orange', 'brown', 'cream']).toContain(piece.colorId);
      expect(piece.cells.length).toBeGreaterThan(0);
      expect(piece.placed).toBe(false);
      
      for (const cell of piece.cells) {
        expect(typeof cell.row).toBe('number');
        expect(typeof cell.col).toBe('number');
      }
    }
  });

  it('on an empty board, at least one valid placement exists (canPlaceAllInAnyOrder is true)', () => {
    const board = createEmptyBoard();
    const pieces = createSmartPieces(board, 0);
    expect(canPlaceAllInAnyOrder(board, pieces)).toBe(true);
  });

  it('for normal boards, canPlaceAllInAnyOrder returns true when possible', () => {
    const board = createEmptyBoard();
    // Simulate a board with some pieces, but still plenty of space
    board[0][0].filled = true;
    board[0][1].filled = true;
    board[1][0].filled = true;
    
    const pieces = createSmartPieces(board, 100);
    expect(canPlaceAllInAnyOrder(board, pieces)).toBe(true);
  });

  it('fallback does not crash on nearly full boards', () => {
    const board = createEmptyBoard();
    // Fill almost the entire board
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c].filled = true;
      }
    }
    // Leave one spot open
    board[0][0].filled = false;

    const pieces = createSmartPieces(board, 0);
    expect(pieces.length).toBe(3);
    // Might not be able to place them all, but it shouldn't crash and should return 3 pieces
  });
});
