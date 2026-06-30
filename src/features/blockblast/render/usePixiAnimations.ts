import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Ticker, Sprite, Texture, Text } from "pixi.js";
import type { ClearAnimation, PlacementAnimation } from "@/features/blockblast/hooks/useBlockBlastGame";
import { BOARD_SIZE } from "@/features/blockblast/game/blockBlastLogic";
import { DEBUG_BLOCK_BLAST_PERF } from "@/features/blockblast/game/debugPerf";
import { cellPoint, CELL, GAP, colorOf } from "@/features/blockblast/game/pixiDrawUtils";

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  life: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

export function usePixiAnimations(
  app: Application | null,
  animationLayer: Container | null,
  clearAnimation: ClearAnimation | null,
  placementAnimation: PlacementAnimation | null,
  ready: boolean
) {
  const placementAnimationIdRef = useRef<string | null>(null);
  const clearAnimationIdRef = useRef<string | null>(null);

  // Particle pool
  const maxParticles = 150;
  const particlesRef = useRef<Particle[]>([]);
  const particleContainerRef = useRef<Container | null>(null);

  useEffect(() => {
    if (!ready || !app || !animationLayer) return;

    if (!particleContainerRef.current) {
      const container = new Container();
      container.eventMode = "none";
      particleContainerRef.current = container;
      animationLayer.addChild(container);

      // Initialize pool
      for (let i = 0; i < maxParticles; i++) {
        const sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.eventMode = "none";
        sprite.visible = false;
        container.addChild(sprite);
        particlesRef.current.push({
          sprite,
          x: 0, y: 0, vx: 0, vy: 0, rotation: 0, vr: 0,
          life: 0, maxLife: 1, baseScale: 1, active: false
        });
      }
    }

    const tick = (ticker: Ticker) => {
      const dt = Math.min(ticker.elapsedMS, 50);
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active) continue;

        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.sprite.visible = false;
          continue;
        }

        p.vy += 0.002 * dt; // slight gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vr * dt;
        
        const progress = 1 - p.life / p.maxLife;
        p.sprite.x = p.x;
        p.sprite.y = p.y;
        p.sprite.rotation = p.rotation;
        p.sprite.alpha = 1 - Math.pow(progress, 2);
        p.sprite.scale.set(p.baseScale * Math.max(0, 1 - progress * 0.5));
      }
    };

    app.ticker.add(tick);

    return () => {
      app.ticker.remove(tick);
      if (particleContainerRef.current) {
        if (animationLayer) animationLayer.removeChild(particleContainerRef.current);
        particleContainerRef.current.destroy({ children: true });
        particleContainerRef.current = null;
      }
      particlesRef.current = [];
    };
  }, [ready, app, animationLayer]);

  useEffect(() => {
    if (!ready || !app || !animationLayer || !placementAnimation) return;
    if (placementAnimationIdRef.current === placementAnimation.id) return;

    placementAnimationIdRef.current = placementAnimation.id;

    const group = new Container();
    group.label = `placement-${placementAnimation.id}`;
    group.eventMode = "none";

    const cellPulses: Container[] = [];
    let sumX = 0;
    let sumY = 0;
    let minY = Number.POSITIVE_INFINITY;

    for (const cell of placementAnimation.cells) {
      const { x, y } = cellPoint(cell.row, cell.col);
      const pulse = new Container();
      pulse.x = x + CELL / 2;
      pulse.y = y + CELL / 2;
      pulse.pivot.set(CELL / 2);

      const ring = new Graphics();
      ring
        .roundRect(0, 0, CELL, CELL, 10)
        .stroke({ width: 4, color: colorOf(cell.colorId), alpha: 0.95 });
      const flash = new Graphics();
      flash
        .roundRect(3, 3, CELL - 6, CELL - 6, 8)
        .fill({ color: 0xffffff, alpha: 0.28 });

      pulse.addChild(ring, flash);
      group.addChild(pulse);
      cellPulses.push(pulse);
      sumX += x + CELL / 2;
      sumY += y + CELL / 2;
      minY = Math.min(minY, y);
    }

    const centerX = sumX / placementAnimation.cells.length;
    const centerY = sumY / placementAnimation.cells.length;
    const shouldShowScore = placementAnimation.clearedCount > 0;
    const scoreText = shouldShowScore
      ? new Text({
          text: `+${placementAnimation.score}`,
          style: {
            fontFamily: "Be Vietnam Pro, Arial, sans-serif",
            fontSize: 28,
            fontWeight: "900",
            fill: 0xfff1a8,
            stroke: { color: 0x2a2418, width: 4 },
            dropShadow: {
              color: 0x000000,
              alpha: 0.32,
              blur: 5,
              distance: 3,
            },
          },
        })
      : null;
    if (scoreText) {
      scoreText.anchor.set(0.5);
      scoreText.x = centerX;
      scoreText.y = Math.min(centerY, minY + 8);
      scoreText.scale.set(0.65);
      group.addChild(scoreText);
    }

    animationLayer.addChild(group);

    let age = 0;
    const totalDuration = 760;

    const tick = (ticker: Ticker) => {
      age += Math.min(ticker.elapsedMS, 50);
      const t = Math.min(age / totalDuration, 1);
      const pop = Math.min(age / 160, 1);
      const easeOut = 1 - Math.pow(1 - pop, 3);

      cellPulses.forEach((pulse, index) => {
        const delay = index * 0.035;
        const localT = Math.max(0, Math.min((t - delay) / 0.55, 1));
        pulse.scale.set(0.84 + easeOut * 0.28 + localT * 0.16);
        pulse.alpha = Math.max(0, 1 - localT * 1.25);
      });

      if (scoreText) {
        scoreText.y = Math.min(centerY, minY + 8) - 46 * (1 - Math.pow(1 - t, 2));
        scoreText.scale.set(0.65 + easeOut * 0.45);
        scoreText.alpha = t < 0.68 ? 1 : Math.max(0, 1 - (t - 0.68) / 0.32);
      }

      if (age >= totalDuration) {
        app.ticker.remove(tick);
        animationLayer.removeChild(group);
        group.destroy({ children: true });
      }
    };

    app.ticker.add(tick);
  }, [placementAnimation, ready, app, animationLayer]);

  // Line Clear Animation
  useEffect(() => {
    if (!ready || !app || !animationLayer || !clearAnimation) return;
    if (clearAnimationIdRef.current === clearAnimation.id) return;

    clearAnimationIdRef.current = clearAnimation.id;

    const group = new Container();
    group.label = clearAnimation.id;
    group.eventMode = "none";
    
    const clearSpawnStart = DEBUG_BLOCK_BLAST_PERF ? performance.now() : 0;

    // Create a container for each cell so we can scale from its center
    const cellContainers: Container[] = [];
    const lineBeams: Graphics[] = [];
    const beamColor = colorOf(clearAnimation.accentColorId ?? clearAnimation.cells[0]?.colorId);
    const boardSpan = BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;

    clearAnimation.clearedRows.forEach((row) => {
      const { x, y } = cellPoint(row, 0);
      const beam = new Graphics();
      beam
        .roundRect(x - 6, y + CELL / 2 - 9, boardSpan + 12, 18, 9)
        .fill({ color: beamColor, alpha: 0.38 })
        .stroke({ width: 2, color: 0xffffff, alpha: 0.68 });
      beam.alpha = 0;
      group.addChild(beam);
      lineBeams.push(beam);
    });

    clearAnimation.clearedCols.forEach((col) => {
      const { x, y } = cellPoint(0, col);
      const beam = new Graphics();
      beam
        .roundRect(x + CELL / 2 - 9, y - 6, 18, boardSpan + 12, 9)
        .fill({ color: beamColor, alpha: 0.38 })
        .stroke({ width: 2, color: 0xffffff, alpha: 0.68 });
      beam.alpha = 0;
      group.addChild(beam);
      lineBeams.push(beam);
    });
    
    for (const cell of clearAnimation.cells) {
      const { x, y } = cellPoint(cell.row, cell.col);
      const c = new Container();
      
      // Set pivot to center so scaling squashes from the middle
      c.x = x + CELL / 2;
      c.y = y + CELL / 2;
      c.pivot.x = CELL / 2;
      c.pivot.y = CELL / 2;
      
      const g = new Sprite(Texture.WHITE);
      g.width = CELL;
      g.height = CELL;
      g.tint = colorOf(cell.colorId);
      
      // Draw white flash overlay
      const flash = new Sprite(Texture.WHITE);
      flash.width = CELL;
      flash.height = CELL;
      flash.alpha = 0.8;
      flash.name = "flash";
      
      c.addChild(g, flash);
      group.addChild(c);
      cellContainers.push(c);
    }
    
    if (DEBUG_BLOCK_BLAST_PERF) {
      console.log(`[PERF] clear_spawn: ${(performance.now() - clearSpawnStart).toFixed(2)}ms`);
    }
    
    animationLayer.addChild(group);

    let age = 0;
    let particlesSpawned = false;

    const tick = (ticker: Ticker) => {
      const dt = Math.min(ticker.elapsedMS, 50);
      age += dt;
      
      // Sequence:
      // 0 - 60ms: Flash overlay fades out, cell scales up slightly (1.0 -> 1.1)
      // 60 - 180ms: Cell scales down to 0 and fades out
      // 180ms: Spawn particles
      
      const phase1Duration = 60;
      const phase2Duration = 120;
      const totalDuration = phase1Duration + phase2Duration;

      for (const c of cellContainers) {
        const flash = c.getChildByName("flash");
        
        if (age <= phase1Duration) {
           const t = age / phase1Duration;
           if (flash) flash.alpha = 0.8 * (1 - t);
           c.scale.set(1 + t * 0.1);
        } else if (age <= totalDuration) {
           if (flash) flash.alpha = 0;
           const t = (age - phase1Duration) / phase2Duration;
           const easeIn = t * t;
           c.scale.set(1.1 * (1 - easeIn));
           c.alpha = 1 - easeIn;
        } else {
           c.alpha = 0;
        }
      }

      for (const beam of lineBeams) {
        if (age <= phase1Duration) {
          const t = age / phase1Duration;
          beam.alpha = Math.sin(t * Math.PI) * 1;
        } else if (age <= totalDuration) {
          const t = (age - phase1Duration) / phase2Duration;
          beam.alpha = Math.max(0, 0.72 * (1 - t));
        } else {
          beam.alpha = 0;
        }
      }

      if (age >= totalDuration && !particlesSpawned) {
        particlesSpawned = true;
        // Spawn particles
        const particles = particlesRef.current;
        let pIndex = 0;
        
        for (const cell of clearAnimation.cells) {
           const { x, y } = cellPoint(cell.row, cell.col);
           const cx = x + CELL / 2;
           const cy = y + CELL / 2;
           
           // Spawn 4-6 particles per cell
           const spawnCount = 4 + Math.random() * 2;
           for (let i = 0; i < spawnCount; i++) {
             // Find next inactive particle
             while (pIndex < particles.length && particles[pIndex].active) pIndex++;
             if (pIndex >= particles.length) break; // limit reached
             
             const p = particles[pIndex];
             p.active = true;
             p.x = cx;
             p.y = cy;
             
             // Random burst velocity
             const angle = Math.random() * Math.PI * 2;
             const speed = 0.2 + Math.random() * 0.4;
             p.vx = Math.cos(angle) * speed;
             p.vy = Math.sin(angle) * speed;
             
             p.rotation = Math.random() * Math.PI * 2;
             p.vr = (Math.random() - 0.5) * 0.02;
             
             p.maxLife = 200 + Math.random() * 200; // 200-400ms life
             p.life = p.maxLife;
             
             p.sprite.visible = true;
             p.sprite.tint = colorOf(cell.colorId);
             const size = 6 + Math.random() * 6;
             // Texture.WHITE is typically 16x16, so size/16 gives the correct scale
             const baseScale = size / 16;
             p.baseScale = baseScale;
             p.sprite.scale.set(baseScale);
           }
        }
      }

      if (age > totalDuration + 50) {
        // Allow some extra time before cleanup just in case
        app.ticker.remove(tick);
        animationLayer.removeChild(group);
        group.destroy({ children: true });
      }
    };

    app.ticker.add(tick);
  }, [clearAnimation, ready, app, animationLayer]);
}
