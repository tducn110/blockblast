interface MascotProps {
  size?: number;
  variantIndex?: number;
  mood?: "idle" | "combo" | "gameOver";
}

const MASCOT_ASSETS = [
  "/assets/optimized/peanut_static-180.webp",
  "/assets/optimized/016_avatar_banhtung_nobg-180.webp",
  "/assets/optimized/017_avatar_tiguayel_nobg-180.webp",
  "/assets/optimized/035_avatar_dogoin_nobg-180.webp",
];

export function Mascot({ size = 120, variantIndex = 0, mood = "idle" }: MascotProps) {
  const normalizedIndex = Math.abs(variantIndex) % MASCOT_ASSETS.length;
  const asset = MASCOT_ASSETS[normalizedIndex];
  const scale = mood === "combo" ? 1.22 : mood === "gameOver" ? 1.1 : 1.16;

  return (
    <div
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
      <img
        src={asset}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 5px 4px rgba(40,27,16,0.18))",
          transform: `scale(${scale})`,
          transformOrigin: "center bottom",
        }}
      />
    </div>
  );
}
