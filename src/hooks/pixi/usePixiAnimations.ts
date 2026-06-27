import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type { ClearAnimation, PlacementAnimation } from "../useBlockBlastGame";
import { cellPoint, drawBlock, CELL, colorOf, BOARD_X, BOARD_Y, BOARD_PIXELS } from "../../utils/pixiDrawUtils";

export function usePixiAnimations(
  app: Application | null,
  animationLayer: Container | null,
  clearAnimation: ClearAnimation | null,
  placementAnimation: PlacementAnimation | null,
  ready: boolean
) {
  const placementAnimationIdRef = useRef<string | null>(null);
  const clearAnimationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !app || !animationLayer || !placementAnimation) return;
    if (placementAnimationIdRef.current === placementAnimation.id) return;

    placementAnimationIdRef.current = placementAnimation.id;

    const group = new Container();
    group.label = placementAnimation.id;

    const flash = new Graphics();
    for (const cell of placementAnimation.cells) {
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
  }, [placementAnimation, ready, app, animationLayer]);

  useEffect(() => {
    if (!ready || !app || !animationLayer || !clearAnimation) return;
    if (clearAnimationIdRef.current === clearAnimation.id) return;

    clearAnimationIdRef.current = clearAnimation.id;

    const group = new Container();
    group.label = clearAnimation.id;

    const cells = new Graphics();
    for (const cell of clearAnimation.cells) {
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
  }, [clearAnimation, ready, app, animationLayer]);
}
