import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Ticker, Sprite, Texture } from "pixi.js";
import type { ClearAnimation, PlacementAnimation } from "../useBlockBlastGame";
import { cellPoint, drawBlock, CELL, colorOf } from "../../utils/pixiDrawUtils";

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
          life: 0, maxLife: 1, active: false
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
        // p.maxScale is stored in vx temporarily or we can just scale down from whatever it is
        // Sprite base scale is set during spawn, we just multiply it by (1 - progress * 0.5)
        p.sprite.scale.set(p.sprite.scale.x * 0.95);
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

  // Placement Impact
  useEffect(() => {
    if (!ready || !app || !animationLayer || !placementAnimation) return;
    if (placementAnimationIdRef.current === placementAnimation.id) return;

    placementAnimationIdRef.current = placementAnimation.id;

    const group = new Container();
    group.label = placementAnimation.id;
    group.eventMode = "none";

    for (const cell of placementAnimation.cells) {
      const { x, y } = cellPoint(cell.row, cell.col);
      const flash = new Sprite(Texture.WHITE);
      flash.width = CELL;
      flash.height = CELL;
      flash.x = x;
      flash.y = y;
      flash.alpha = 0.6;
      group.addChild(flash);
    }
    animationLayer.addChild(group);

    let age = 0;
    const tick = (ticker: Ticker) => {
      age += Math.min(ticker.elapsedMS, 50);
      const t = Math.min(age / 120, 1); // 120ms flash duration
      
      group.alpha = 1 - t;
      
      // Simple squash effect on the center of the placement could be done per cell,
      // but a simple fading flash is very effective for impact.

      if (t >= 1) {
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
    
    performance.mark("clear_spawn_start");

    // Create a container for each cell so we can scale from its center
    const cellContainers: Container[] = [];
    
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
    
    performance.mark("clear_spawn_end");
    performance.measure("clear_spawn", "clear_spawn_start", "clear_spawn_end");
    const m = performance.getEntriesByName("clear_spawn").pop();
    if (m) console.log(`[PERF] clear_spawn: ${m.duration.toFixed(2)}ms`);
    
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
