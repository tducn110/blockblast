import { useEffect, useRef } from "react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
} from "pixi.js";
import {
  BLOCK_BORDER_MAP,
  BLOCK_COLOR_MAP,
  BOARD_SIZE,
  BoardGrid,
  BlockPiece,
} from "../../utils/blockBlastLogic";
import type { ClearAnimation, PlacementAnimation } from "../../hooks/useBlockBlastGame";

interface PixiBlockBlastCanvasProps {
  board: BoardGrid;
  pieces: BlockPiece[];
  selectedPieceId: string | null;
  status: "playing" | "gameOver";
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
  onSelectPiece: (id: string | null) => void;
  onPlacePiece: (id: string, row: number, col: number) => boolean;
}

const VIEW_WIDTH = 382;
const VIEW_HEIGHT = 486;
const BOARD_X = 23;
const BOARD_Y = 22;
const CELL = 42;
const GAP = 3;
const BOARD_PIXELS = BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;
const TRAY_Y = BOARD_Y + BOARD_PIXELS + 28;
const PIECE_SLOT_WIDTH = 112;
const PIECE_SLOT_HEIGHT = 94;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function colorOf(colorId?: string): number {
  return hexToNumber(BLOCK_COLOR_MAP[colorId ?? "peanut"] ?? BLOCK_COLOR_MAP.peanut);
}

function borderOf(colorId?: string): number {
  return hexToNumber(BLOCK_BORDER_MAP[colorId ?? "peanut"] ?? BLOCK_BORDER_MAP.peanut);
}

function drawBlock(
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

function drawBoardBackground(g: Graphics) {
  g.roundRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 24)
    .fill({ color: 0xf5ecd7, alpha: 1 })
    .stroke({ width: 2, color: 0x8a7d65, alpha: 0.28 });

  g.moveTo(0, 132)
    .bezierCurveTo(86, 86, 148, 172, 238, 119)
    .bezierCurveTo(296, 84, 332, 98, 382, 74)
    .lineTo(382, 0)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0xe6d8b2, alpha: 0.36 });

  g.moveTo(0, 216)
    .bezierCurveTo(86, 188, 134, 228, 216, 196)
    .bezierCurveTo(288, 168, 334, 194, 382, 162)
    .lineTo(382, 0)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0xc8d68a, alpha: 0.22 });

  g.roundRect(BOARD_X - 8, BOARD_Y - 8, BOARD_PIXELS + 16, BOARD_PIXELS + 16, 22)
    .fill({ color: 0xefe3c4, alpha: 0.88 })
    .stroke({ width: 2, color: 0x8a7d65, alpha: 0.22 });
}

function cellPoint(row: number, col: number) {
  return {
    x: BOARD_X + col * (CELL + GAP),
    y: BOARD_Y + row * (CELL + GAP),
  };
}

function drawBoard(boardLayer: Container, board: BoardGrid) {
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
}

function pieceBounds(piece: BlockPiece) {
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

function drawPieces(
  piecesLayer: Container,
  pieces: BlockPiece[],
  selectedPieceId: string | null,
  onSelectPiece: (id: string | null) => void,
  onStartDrag: (piece: BlockPiece, event: FederatedPointerEvent) => void
) {
  piecesLayer.removeChildren();

  pieces.forEach((piece, index) => {
    const slotX = 19 + index * PIECE_SLOT_WIDTH;
    const slot = new Container();
    slot.x = slotX;
    slot.y = TRAY_Y;

    const isSelected = selectedPieceId === piece.id;
    const shell = new Graphics();
    shell.roundRect(0, 0, PIECE_SLOT_WIDTH - 10, PIECE_SLOT_HEIGHT, 18)
      .fill({ color: piece.placed ? 0xefe3c4 : 0xfdf6ea, alpha: piece.placed ? 0.58 : 0.92 })
      .stroke({
        width: isSelected ? 3 : 1.5,
        color: isSelected ? 0xe87432 : 0x8a7d65,
        alpha: isSelected ? 0.95 : 0.26,
      });
    slot.addChild(shell);

    const pieceGraphic = new Graphics();
    const bounds = pieceBounds(piece);
    const previewCell = Math.min(22, Math.floor((PIECE_SLOT_WIDTH - 28) / bounds.width));
    const previewGap = 2;
    const pieceWidth = bounds.width * previewCell + (bounds.width - 1) * previewGap;
    const pieceHeight = bounds.height * previewCell + (bounds.height - 1) * previewGap;
    const startX = (PIECE_SLOT_WIDTH - 10 - pieceWidth) / 2;
    const startY = (PIECE_SLOT_HEIGHT - pieceHeight) / 2;
    const pieceAlpha = piece.placed ? 0.22 : 1;

    for (const cell of piece.cells) {
      const x = startX + (cell.col - bounds.minCol) * (previewCell + previewGap);
      const y = startY + (cell.row - bounds.minRow) * (previewCell + previewGap);
      drawBlock(pieceGraphic, x, y, previewCell, piece.colorId, pieceAlpha);
    }
    slot.addChild(pieceGraphic);

    if (piece.placed) {
      const mark = new Graphics();
      mark.roundRect(31, 34, 40, 16, 8)
        .fill({ color: 0x2a2418, alpha: 0.16 })
        .stroke({ width: 1, color: 0x2a2418, alpha: 0.16 });
      slot.addChild(mark);
    } else {
      slot.eventMode = "static";
      slot.cursor = "pointer";
      slot.hitArea = new Rectangle(0, 0, PIECE_SLOT_WIDTH - 10, PIECE_SLOT_HEIGHT);
      slot.on("pointertap", () => onSelectPiece(isSelected ? null : piece.id));
      slot.on("pointerdown", (event: FederatedPointerEvent) => onStartDrag(piece, event));
    }

    piecesLayer.addChild(slot);
  });
}

function playPlacement(
  animationLayer: Container,
  animation: PlacementAnimation,
  app: Application
) {
  const group = new Container();
  group.label = animation.id;

  const flash = new Graphics();
  for (const cell of animation.cells) {
    const { x, y } = cellPoint(cell.row, cell.col);
    drawBlock(flash, x, y, CELL, cell.colorId, 1);
  }
  group.addChild(flash);
  animationLayer.addChild(group);

  let age = 0;
  const tick = () => {
    age += app.ticker.deltaMS;
    const t = Math.min(age / 320, 1);
    const pulse = Math.sin(t * Math.PI);
    group.alpha = 1 - t * 0.15;
    group.scale.set(1 + pulse * 0.035);
    group.x = -((BOARD_X + BOARD_PIXELS / 2) * (group.scale.x - 1));
    group.y = -((BOARD_Y + BOARD_PIXELS / 2) * (group.scale.y - 1));

    if (t >= 1) {
      app.ticker.remove(tick);
      animationLayer.removeChild(group);
      group.destroy({ children: true });
    }
  };

  app.ticker.add(tick);
}

function playClear(animationLayer: Container, animation: ClearAnimation, app: Application) {
  const group = new Container();
  group.label = animation.id;

  const cells = new Graphics();
  for (const cell of animation.cells) {
    const { x, y } = cellPoint(cell.row, cell.col);
    cells.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 10)
      .fill({ color: 0xffffff, alpha: 0.88 })
      .stroke({ width: 2, color: colorOf(cell.colorId), alpha: 0.92 });
  }
  group.addChild(cells);
  animationLayer.addChild(group);

  let age = 0;
  const tick = () => {
    age += app.ticker.deltaMS;
    const t = Math.min(age / 460, 1);
    group.alpha = 1 - t;
    group.scale.set(1 + t * 0.08);
    group.x = -((BOARD_X + BOARD_PIXELS / 2) * (group.scale.x - 1));
    group.y = -((BOARD_Y + BOARD_PIXELS / 2) * (group.scale.y - 1));

    if (t >= 1) {
      app.ticker.remove(tick);
      animationLayer.removeChild(group);
      group.destroy({ children: true });
    }
  };

  app.ticker.add(tick);
}

export function PixiBlockBlastCanvas({
  board,
  pieces,
  selectedPieceId,
  status,
  clearAnimation,
  placementAnimation,
  onSelectPiece,
  onPlacePiece,
}: PixiBlockBlastCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const piecesLayerRef = useRef<Container | null>(null);
  const animationLayerRef = useRef<Container | null>(null);
  const dragLayerRef = useRef<Container | null>(null);
  const dragGhostRef = useRef<Graphics | null>(null);
  const draggingPieceRef = useRef<BlockPiece | null>(null);
  const latestRef = useRef({ selectedPieceId, onPlacePiece });
  const placementAnimationIdRef = useRef<string | null>(null);
  const clearAnimationIdRef = useRef<string | null>(null);

  useEffect(() => {
    latestRef.current = { selectedPieceId, onPlacePiece };
  }, [selectedPieceId, onPlacePiece]);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();

    async function init() {
      await app.init({
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true,
        preference: "webgl",
        resolution: Math.min(window.devicePixelRatio || 1, 1.5),
        eventFeatures: {
          click: true,
          globalMove: true,
          move: true,
          wheel: false,
        },
      });

      if (cancelled || !hostRef.current) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
        return;
      }

      appRef.current = app;
      app.canvas.style.width = "100%";
      app.canvas.style.height = "auto";
      app.canvas.style.display = "block";
      app.canvas.style.touchAction = "manipulation";
      hostRef.current.appendChild(app.canvas);

      const background = new Graphics();
      drawBoardBackground(background);
      app.stage.addChild(background);

      const boardLayer = new Container();
      const animationLayer = new Container();
      const piecesLayer = new Container();
      const dragLayer = new Container();

      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      app.stage.on("globalpointermove", (event: FederatedPointerEvent) => {
        const ghost = dragGhostRef.current;
        if (!ghost) return;
        ghost.x = event.global.x - ghost.width / 2;
        ghost.y = event.global.y - ghost.height / 2;
      });
      app.stage.on("pointerup", (event: FederatedPointerEvent) => {
        const piece = draggingPieceRef.current;
        const ghost = dragGhostRef.current;
        if (!piece || !ghost) return;

        const col = Math.floor((event.global.x - BOARD_X) / (CELL + GAP));
        const row = Math.floor((event.global.y - BOARD_Y) / (CELL + GAP));
        if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
          latestRef.current.onPlacePiece(piece.id, row, col);
        }

        dragLayer.removeChild(ghost);
        ghost.destroy();
        dragGhostRef.current = null;
        draggingPieceRef.current = null;
      });
      app.stage.on("pointerupoutside", () => {
        const ghost = dragGhostRef.current;
        if (!ghost) return;
        dragLayer.removeChild(ghost);
        ghost.destroy();
        dragGhostRef.current = null;
        draggingPieceRef.current = null;
      });

      boardLayer.eventMode = "static";
      boardLayer.hitArea = new Rectangle(BOARD_X, BOARD_Y, BOARD_PIXELS, BOARD_PIXELS);
      boardLayer.on("pointertap", (event: FederatedPointerEvent) => {
        const current = latestRef.current;
        if (!current.selectedPieceId) return;

        const local = event.global;
        const col = Math.floor((local.x - BOARD_X) / (CELL + GAP));
        const row = Math.floor((local.y - BOARD_Y) / (CELL + GAP));

        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
        current.onPlacePiece(current.selectedPieceId, row, col);
      });

      boardLayerRef.current = boardLayer;
      piecesLayerRef.current = piecesLayer;
      animationLayerRef.current = animationLayer;
      dragLayerRef.current = dragLayer;
      app.stage.addChild(boardLayer, animationLayer, piecesLayer, dragLayer);
      drawBoard(boardLayer, board);
      drawPieces(piecesLayer, pieces, selectedPieceId, onSelectPiece, (piece, event) => {
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
        onSelectPiece(piece.id);
      });
    }

    init();

    return () => {
      cancelled = true;
      boardLayerRef.current = null;
      piecesLayerRef.current = null;
      animationLayerRef.current = null;
      dragLayerRef.current = null;
      dragGhostRef.current = null;
      draggingPieceRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true }
        );
      }
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!boardLayerRef.current) return;
    drawBoard(boardLayerRef.current, board);
  }, [board]);

  useEffect(() => {
    if (!piecesLayerRef.current) return;
    const dragLayer = dragLayerRef.current;
    drawPieces(piecesLayerRef.current, pieces, selectedPieceId, onSelectPiece, (piece, event) => {
      if (!dragLayer) return;

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
      onSelectPiece(piece.id);
    });
  }, [pieces, selectedPieceId, onSelectPiece]);

  useEffect(() => {
    const app = appRef.current;
    const animationLayer = animationLayerRef.current;
    if (!app || !animationLayer || !placementAnimation) return;
    if (placementAnimationIdRef.current === placementAnimation.id) return;

    placementAnimationIdRef.current = placementAnimation.id;
    playPlacement(animationLayer, placementAnimation, app);
  }, [placementAnimation]);

  useEffect(() => {
    const app = appRef.current;
    const animationLayer = animationLayerRef.current;
    if (!app || !animationLayer || !clearAnimation) return;
    if (clearAnimationIdRef.current === clearAnimation.id) return;

    clearAnimationIdRef.current = clearAnimation.id;
    playClear(animationLayer, clearAnimation, app);
  }, [clearAnimation]);

  useEffect(() => {
    if (!appRef.current || !appRef.current.canvas) return;
    appRef.current.canvas.style.filter = status === "gameOver" ? "saturate(0.7)" : "none";
  }, [status]);

  return (
    <div
      ref={hostRef}
      aria-label="Bảng chơi Xếp Khối"
      style={{
        width: "100%",
        aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(138,125,101,0.24)",
      }}
    />
  );
}
