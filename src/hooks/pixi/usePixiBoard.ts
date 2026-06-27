import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import { BoardGrid, BOARD_SIZE } from "../../utils/blockBlastLogic";
import { cellPoint, CELL, drawBlock } from "../../utils/pixiDrawUtils";

export function usePixiBoard(boardLayer: Container | null, board: BoardGrid, ready: boolean) {
  useEffect(() => {
    if (!ready || !boardLayer) return;

    boardLayer.removeChildren();

    const grid = new Graphics();
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const { x, y } = cellPoint(row, col);
        grid.roundRect(x, y, CELL, CELL, 9)
          .fill({ color: 0xfdf6ea, alpha: 0.96 })
          .stroke({ width: 1.5, color: 0x8a7d65, alpha: 0.18 });
      }
    }
    boardLayer.addChild(grid);

    const blocks = new Graphics();
    for (const row of board) {
      for (const cell of row) {
        if (!cell.filled) continue;
        const { x, y } = cellPoint(cell.row, cell.col);
        drawBlock(blocks, x, y, CELL, cell.colorId, 1);
      }
    }
    boardLayer.addChild(blocks);
  }, [board, boardLayer, ready]);
}
