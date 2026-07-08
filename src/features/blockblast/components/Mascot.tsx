import { useEffect, useRef } from "react";
import gsap from "gsap";

interface MascotProps {
  size?: number;
  variantIndex?: number;
  mood?: "idle" | "combo" | "boom" | "gameOver";
}

const MASCOT_ASSETS = [
  "/assets/optimized/peanut_static-180.webp",
  "/assets/optimized/016_avatar_banhtung_nobg-180.webp",
  "/assets/optimized/017_avatar_tiguayel_nobg-180.webp",
  "/assets/optimized/035_avatar_dogoin_nobg-180.webp",
];
const FALLBACK_MASCOT_ASSET = "/assets/optimized/peanut_static-180.webp";

export function Mascot({ size = 120, variantIndex = 0, mood = "idle" }: MascotProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const burstRef = useRef<HTMLSpanElement | null>(null);
  const normalizedIndex = Math.abs(variantIndex) % MASCOT_ASSETS.length;
  const asset = MASCOT_ASSETS[normalizedIndex];
  const scale = mood === "boom" ? 1.3 : mood === "combo" ? 1.22 : mood === "gameOver" ? 1.1 : 1.16;

  useEffect(() => {
    const preloadedImages = MASCOT_ASSETS.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });

    return () => {
      preloadedImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  useEffect(() => {
    if (!frameRef.current || !imgRef.current || !burstRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      gsap.set(imgRef.current, { opacity: 1, rotate: 0, scale, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline();
      timeline.fromTo(
        imgRef.current,
        { opacity: 0, rotate: mood === "boom" ? -12 : -5, scale: 0.76, y: 10 },
        {
          opacity: 1,
          rotate: 0,
          scale,
          y: 0,
          duration: mood === "boom" ? 0.5 : 0.34,
          ease: mood === "boom" ? "back.out(2)" : "power2.out",
        }
      );

      if (mood === "boom") {
        timeline.fromTo(
          burstRef.current,
          { opacity: 0.75, scale: 0.35 },
          { opacity: 0, scale: 1.9, duration: 0.72, ease: "power3.out" },
          0.04
        );
      }
    }, frameRef);

    return () => ctx.revert();
  }, [asset, mood, scale]);

  return (
    <div
      ref={frameRef}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        animation: mood === "gameOver" ? "none" : "mascot-breathe 1.8s ease-in-out infinite",
      }}
      aria-label="Mascot"
    >
      <span
        ref={burstRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: 999,
          border: "2px solid rgba(240,184,64,0.82)",
          opacity: 0,
          transformOrigin: "center",
          zIndex: 0,
        }}
      />
      <img
        ref={imgRef}
        src={asset}
        alt=""
        draggable={false}
        onError={(event) => {
          const image = event.currentTarget;
          if (image.currentSrc.endsWith(FALLBACK_MASCOT_ASSET)) return;
          image.src = FALLBACK_MASCOT_ASSET;
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 5px 4px rgba(40,27,16,0.18))",
          transformOrigin: "center bottom",
          zIndex: 1,
        }}
      />
    </div>
  );
}
