import { useEffect, useRef } from "react";
import { Container, Graphics } from "pixi.js";
import { BoardGrid, BOARD_SIZE } from "../../utils/blockBlastLogic";
import { cellPoint, CELL, drawBlock } from "../../utils/pixiDrawUtils";

export function usePixiBoard(boardLayer: Container | null, board: BoardGrid, ready: boolean) {
  const gridRef = useRef<Graphics | null>(null);
  const blocksRef = useRef<Graphics | null>(null);

  useEffect(() => {
    if (!ready || !boardLayer) return;

    if (!gridRef.current) {
      const grid = new Graphics();
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          const { x, y } = cellPoint(row, col);
          grid.roundRect(x, y, CELL, CELL, 9)
            .fill({ color: 0xfdf6ea, alpha: 0.96 })
            .stroke({ width: 1.5, color: 0x8a7d65, alpha: 0.18 });
        }
      }
      gridRef.current = grid;
      boardLayer.addChild(grid);
    }

    if (!blocksRef.current) {
      const blocks = new Graphics();
      blocksRef.current = blocks;
      boardLayer.addChild(blocks);
    }

    const blocks = blocksRef.current;
    blocks.clear();
    for (const row of board) {
      for (const cell of row) {
        if (!cell.filled) continue;
        const { x, y } = cellPoint(cell.row, cell.col);
        drawBlock(blocks, x, y, CELL, cell.colorId, 1);
      }
    }
  }, [board, boardLayer, ready]);

  useEffect(() => {
    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
      if (blocksRef.current) {
        blocksRef.current.destroy();
        blocksRef.current = null;
      }
    };
  }, []);
}
