interface LogoBubbleProps {
  label?: string;
  size?: number;
}

export function LogoBubble({ label = "L", size = 34 }: LogoBubbleProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #ffe08a 0%, #f0b840 48%, #c8920c 100%)",
        border: "2px solid #2a2418",
        display: "grid",
        placeItems: "center",
        color: "#fffaf0",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontWeight: 900,
        fontSize: Math.max(12, size * 0.42),
        lineHeight: 1,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 5px 12px rgba(42,36,24,0.16)",
      }}
    >
      {label}
    </div>
  );
}
