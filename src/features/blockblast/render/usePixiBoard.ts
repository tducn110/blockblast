import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { BoardGrid, BOARD_SIZE } from "@/features/blockblast/game/blockBlastLogic";
import { cellPoint, CELL, GAP, getBlockTexture } from "@/features/blockblast/game/pixiDrawUtils";

interface CellGraphics {
  bg: Graphics;
  block: Sprite;
}

export function usePixiBoard(app: Application, boardLayer: Container | null, board: BoardGrid, ready: boolean) {
  const gridRef = useRef<Graphics | null>(null);
  const blocksRef = useRef<Container | null>(null);
  const cellsRef = useRef<CellGraphics[][] | null>(null);

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
      const blocksContainer = new Container();
      blocksRef.current = blocksContainer;
      
      const cells: CellGraphics[][] = [];
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        cells[row] = [];
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          const { x, y } = cellPoint(row, col);
          
          const bg = new Graphics();
          bg.roundRect(0, 0, CELL, CELL, 9)
            .fill({ color: 0xfdf6ea, alpha: 0.96 })
            .stroke({ width: 1.5, color: 0x8a7d65, alpha: 0.18 });
          bg.x = x;
          bg.y = y;

          const block = new Sprite();
          block.x = x;
          block.y = y;
          block.visible = false;
          
          blocksContainer.addChild(bg, block);
          cells[row][col] = { bg, block };
        }
      }
      cellsRef.current = cells;
      boardLayer.addChild(blocksContainer);
    }

    if (!cellsRef.current) return;
    
    if ((globalThis as any).__lastPlacePieceTime) {
       console.log(`[PERF] react_commit_delay: ${(performance.now() - (globalThis as any).__lastPlacePieceTime).toFixed(2)}ms`);
       (globalThis as any).__lastPlacePieceTime = 0;
    }

    performance.mark("board_visual_update_start");

    const cells = cellsRef.current!;
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellState = board[row][col];
        const cellG = cells[row][col];
        
        if (cellState.filled) {
          cellG.block.texture = getBlockTexture(app, CELL, cellState.colorId || "peanut");
          cellG.block.visible = true;
          cellG.bg.alpha = 1;
        } else {
          cellG.block.visible = false;
          cellG.bg.alpha = 1;
        }
      }
    }

    performance.mark("board_visual_update_end");
    performance.measure("board_visual_update", "board_visual_update_start", "board_visual_update_end");
    const measure = performance.getEntriesByName("board_visual_update").pop();
    if (measure) {
       console.log(`[PERF] board_visual_update: ${measure.duration.toFixed(2)}ms`);
    }
  }, [board, boardLayer, ready]);

  useEffect(() => {
    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
      if (blocksRef.current) {
        blocksRef.current.destroy({ children: true });
        blocksRef.current = null;
        cellsRef.current = null;
      }
    };
  }, []);
}
