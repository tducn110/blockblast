import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Rectangle } from "pixi.js";
import { VIEW_WIDTH, VIEW_HEIGHT } from "@/features/blockblast/game/pixiDrawUtils";
import { createGameWorldTransform } from "@/features/blockblast/layout/gameViewport";
import { useMeasuredGameViewport } from "@/features/blockblast/layout/useMeasuredGameViewport";

const MAX_PIXI_RESOLUTION = 2;

export function usePixiApp() {
  const { containerRef: hostRef, viewport, layoutMode } = useMeasuredGameViewport();
  const appRef = useRef<Application | null>(null);
  const gameWorldRef = useRef<Container | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const piecesLayerRef = useRef<Container | null>(null);
  const animationLayerRef = useRef<Container | null>(null);
  const dragLayerRef = useRef<Container | null>(null);
  const [ready, setReady] = useState(false);
  const worldTransform = useMemo(
    () => createGameWorldTransform(viewport.width, viewport.height),
    [viewport.width, viewport.height]
  );

  useEffect(() => {
    let cancelled = false;
    const app = new Application();

    async function init() {
      const resolution = Math.min(window.devicePixelRatio || 1, MAX_PIXI_RESOLUTION);

      await app.init({
        width: viewport.width,
        height: viewport.height,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true,
        preference: "webgl",
        resolution,
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
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.touchAction = "none";
      hostRef.current.appendChild(app.canvas);

      const gameWorld = new Container();
      const boardLayer = new Container();
      const animationLayer = new Container();
      const piecesLayer = new Container();
      const dragLayer = new Container();

      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, viewport.width, viewport.height);
      gameWorld.scale.set(worldTransform.scale);
      gameWorld.position.set(worldTransform.x, worldTransform.y);
      
      gameWorldRef.current = gameWorld;
      boardLayerRef.current = boardLayer;
      piecesLayerRef.current = piecesLayer;
      animationLayerRef.current = animationLayer;
      dragLayerRef.current = dragLayer;

      gameWorld.addChild(boardLayer, piecesLayer, dragLayer, animationLayer);
      app.stage.addChild(gameWorld);
      
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      gameWorldRef.current = null;
      boardLayerRef.current = null;
      piecesLayerRef.current = null;
      animationLayerRef.current = null;
      dragLayerRef.current = null;
      
      if (appRef.current) {
        appRef.current.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true }
        );
      }
      appRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !appRef.current) return;

    appRef.current.renderer.resize(viewport.width, viewport.height);
    appRef.current.stage.hitArea = new Rectangle(0, 0, viewport.width, viewport.height);

    if (gameWorldRef.current) {
      gameWorldRef.current.scale.set(worldTransform.scale);
      gameWorldRef.current.position.set(worldTransform.x, worldTransform.y);
    }

    appRef.current.render();
  }, [ready, viewport.width, viewport.height, worldTransform]);

  return {
    hostRef,
    appRef,
    gameWorldRef,
    boardLayerRef,
    piecesLayerRef,
    animationLayerRef,
    dragLayerRef,
    viewport,
    layoutMode,
    worldTransform,
    ready
  };
}
