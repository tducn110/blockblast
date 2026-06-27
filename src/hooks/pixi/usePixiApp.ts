import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Rectangle } from "pixi.js";
import { VIEW_WIDTH, VIEW_HEIGHT, drawBoardBackground } from "../../utils/pixiDrawUtils";

export function usePixiApp() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const piecesLayerRef = useRef<Container | null>(null);
  const animationLayerRef = useRef<Container | null>(null);
  const dragLayerRef = useRef<Container | null>(null);
  const [ready, setReady] = useState(false);

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
      
      boardLayerRef.current = boardLayer;
      piecesLayerRef.current = piecesLayer;
      animationLayerRef.current = animationLayer;
      dragLayerRef.current = dragLayer;

      app.stage.addChild(boardLayer, animationLayer, piecesLayer, dragLayer);
      
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
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

  return {
    hostRef,
    appRef,
    boardLayerRef,
    piecesLayerRef,
    animationLayerRef,
    dragLayerRef,
    ready
  };
}
