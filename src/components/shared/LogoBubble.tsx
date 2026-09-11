interface LogoBubbleProps {
  size?: number;
}

export function LogoBubble({ size = 34 }: LogoBubbleProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #ffe08a 0%, #f0b840 48%, #c8920c 100%)",
        border: "1px solid rgba(255,250,240,0.82)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        color: "#fffaf0",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontWeight: 900,
        fontSize: Math.max(12, size * 0.42),
        lineHeight: 1,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.62), 0 6px 16px rgba(200,146,12,0.22)",
      }}
    >
      <img
        src="/assets/brand/PapaStudio_Logo_Symbol_White.png"
        alt=""
        draggable={false}
        style={{ width: "72%", height: "72%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
