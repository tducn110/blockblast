import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle, FederatedPointerEvent } from "pixi.js";
import { BlockPiece, BOARD_SIZE } from "../../utils/blockBlastLogic";
import {
  PIECE_SLOT_WIDTH,
  TRAY_Y,
  TRAY_X,
  PIECE_SLOT_GAP,
  PIECE_SLOT_HEIGHT,
  pieceBounds,
  drawBlock,
  CELL,
  GAP,
  BOARD_X,
  BOARD_Y
} from "../../utils/pixiDrawUtils";

interface SlotObjects {
  container: Container;
  shell: Graphics;
  pieceGraphic: Graphics;
  mark: Graphics;
  pieceId: string | null;
}

export function usePixiPieces(
  app: Application | null,
  piecesLayer: Container | null,
  dragLayer: Container | null,
  boardLayer: Container | null,
  pieces: BlockPiece[],
  selectedPieceId: string | null,
  onSelectPiece: (id: string | null) => void,
  onPlacePiece: (id: string, row: number, col: number) => boolean,
  ready: boolean
) {
  const dragGhostRef = useRef<Graphics | null>(null);
  const draggingPieceRef = useRef<BlockPiece | null>(null);
  const latestRef = useRef({ selectedPieceId, onPlacePiece, onSelectPiece });
  const slotsRef = useRef<SlotObjects[]>([]);

  useEffect(() => {
    latestRef.current = { selectedPieceId, onPlacePiece, onSelectPiece };
  }, [selectedPieceId, onPlacePiece, onSelectPiece]);

  // Setup global drag listeners on app stage
  useEffect(() => {
    if (!ready || !app || !dragLayer || !boardLayer) return;

    const onGlobalMove = (event: FederatedPointerEvent) => {
      const ghost = dragGhostRef.current;
      if (!ghost) return;
      ghost.x = event.global.x - ghost.width / 2;
      ghost.y = event.global.y - ghost.height / 2;
    };

    const cleanupDrag = () => {
      const ghost = dragGhostRef.current;
      if (!ghost) return;
      dragLayer.removeChild(ghost);
      ghost.destroy();
      dragGhostRef.current = null;
      draggingPieceRef.current = null;
    };

    const onPointerUp = (event: FederatedPointerEvent) => {
      const piece = draggingPieceRef.current;
      const ghost = dragGhostRef.current;
      if (!piece || !ghost) return;

      const col = Math.floor((event.global.x - BOARD_X) / (CELL + GAP));
      const row = Math.floor((event.global.y - BOARD_Y) / (CELL + GAP));
      if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        latestRef.current.onPlacePiece(piece.id, row, col);
      }

      cleanupDrag();
    };

    const onBoardTap = (event: FederatedPointerEvent) => {
      const current = latestRef.current;
      if (!current.selectedPieceId) return;

      const local = event.global;
      const col = Math.floor((local.x - BOARD_X) / (CELL + GAP));
      const row = Math.floor((local.y - BOARD_Y) / (CELL + GAP));

      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
      current.onPlacePiece(current.selectedPieceId, row, col);
    };

    app.stage.on("globalpointermove", onGlobalMove);
    app.stage.on("pointerup", onPointerUp);
    app.stage.on("pointerupoutside", cleanupDrag);

    boardLayer.eventMode = "static";
    const BOARD_PIXELS = BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;
    boardLayer.hitArea = new Rectangle(BOARD_X, BOARD_Y, BOARD_PIXELS, BOARD_PIXELS);
    boardLayer.on("pointertap", onBoardTap);

    return () => {
      app.stage.off("globalpointermove", onGlobalMove);
      app.stage.off("pointerup", onPointerUp);
      app.stage.off("pointerupoutside", cleanupDrag);
      boardLayer.off("pointertap", onBoardTap);
    };
  }, [ready, app, dragLayer, boardLayer]);

  // Setup and update pieces
  useEffect(() => {
    if (!ready || !piecesLayer || !dragLayer) return;

    if (slotsRef.current.length === 0) {
      // Initialize slots once
      for (let index = 0; index < 3; index++) {
        const slotX = TRAY_X + index * (PIECE_SLOT_WIDTH + PIECE_SLOT_GAP);
        const container = new Container();
        container.x = slotX;
        container.y = TRAY_Y;
        container.eventMode = "static";
        container.cursor = "pointer";
        container.hitArea = new Rectangle(0, 0, PIECE_SLOT_WIDTH, PIECE_SLOT_HEIGHT);

        const shell = new Graphics();
        const pieceGraphic = new Graphics();
        const mark = new Graphics();
        
        container.addChild(shell, pieceGraphic, mark);
        piecesLayer.addChild(container);

        container.on("pointertap", () => {
          const slot = slotsRef.current[index];
          if (!slot || !slot.pieceId) return;
          const current = latestRef.current;
          const isSelected = current.selectedPieceId === slot.pieceId;
          current.onSelectPiece(isSelected ? null : slot.pieceId);
        });

        container.on("pointerdown", (event: FederatedPointerEvent) => {
          const slot = slotsRef.current[index];
          if (!slot || !slot.pieceId) return;
          const piece = pieces.find(p => p.id === slot.pieceId);
          if (!piece || piece.placed) return;

          const existingGhost = dragGhostRef.current;
          if (existingGhost) {
            dragLayer.removeChild(existingGhost);
            existingGhost.destroy();
          }

          const ghost = new Graphics();
          const bounds = pieceBounds(piece);
          for (const cell of piece.cells) {
            const x = (cell.col - bounds.minCol) * (CELL + GAP);
            const y = (cell.row - bounds.minRow) * (CELL + GAP);
            drawBlock(ghost, x, y, CELL, piece.colorId, 0.92);
          }

          ghost.alpha = 0.86;
          ghost.x = event.global.x - ghost.width / 2;
          ghost.y = event.global.y - ghost.height / 2;
          dragLayer.addChild(ghost);
          dragGhostRef.current = ghost;
          draggingPieceRef.current = piece;
          latestRef.current.onSelectPiece(piece.id);
        });

        slotsRef.current.push({ container, shell, pieceGraphic, mark, pieceId: null });
      }
    }

    // Update slots with current pieces
    pieces.forEach((piece, index) => {
      const slot = slotsRef.current[index];
      if (!slot) return;
      
      slot.pieceId = piece.id;
      const isSelected = selectedPieceId === piece.id;

      slot.shell.clear();
      slot.shell.roundRect(0, 0, PIECE_SLOT_WIDTH, PIECE_SLOT_HEIGHT, 18)
        .fill({ color: piece.placed ? 0xefe3c4 : 0xfdf6ea, alpha: piece.placed ? 0.58 : 0.92 })
        .stroke({
          width: isSelected ? 3 : 1.5,
          color: isSelected ? 0xe87432 : 0x8a7d65,
          alpha: isSelected ? 0.95 : 0.26,
        });

      slot.pieceGraphic.clear();
      if (!piece.placed) {
        const bounds = pieceBounds(piece);
        const previewCell = Math.min(24, Math.floor((PIECE_SLOT_WIDTH - 24) / bounds.width));
        const previewGap = 2;
        const pieceWidth = bounds.width * previewCell + (bounds.width - 1) * previewGap;
        const pieceHeight = bounds.height * previewCell + (bounds.height - 1) * previewGap;
        const startX = (PIECE_SLOT_WIDTH - pieceWidth) / 2;
        const startY = (PIECE_SLOT_HEIGHT - pieceHeight) / 2;

        for (const cell of piece.cells) {
          const x = startX + (cell.col - bounds.minCol) * (previewCell + previewGap);
          const y = startY + (cell.row - bounds.minRow) * (previewCell + previewGap);
          drawBlock(slot.pieceGraphic, x, y, previewCell, piece.colorId, 1);
        }
      }

      slot.mark.clear();
      if (piece.placed) {
        slot.mark.roundRect(37, 42, 40, 16, 8)
          .fill({ color: 0x2a2418, alpha: 0.16 })
          .stroke({ width: 1, color: 0x2a2418, alpha: 0.16 });
      }
    });

  }, [pieces, selectedPieceId, ready, piecesLayer, dragLayer]);

  useEffect(() => {
    return () => {
      slotsRef.current.forEach(slot => {
        slot.container.destroy({ children: true });
      });
      slotsRef.current = [];
    };
  }, []);
}
