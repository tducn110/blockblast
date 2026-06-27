interface MascotProps {
  size?: number;
}

export function Mascot({ size = 120 }: MascotProps) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
      aria-label="Mascot"
    >
      <img
        src="/assets/optimized/peanut_static-180.webp"
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 5px 4px rgba(40,27,16,0.18))",
          transform: `scale(1.14)`,
          transformOrigin: "center bottom",
        }}
      />
    </div>
  );
}
