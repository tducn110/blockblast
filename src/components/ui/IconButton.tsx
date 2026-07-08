import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { blockBlastAudio } from "@/features/blockblast/audio/blockBlastAudio";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: number;
}

export function IconButton({
  label,
  children,
  size = 34,
  style,
  type = "button",
  disabled,
  onClick,
  ...props
}: IconButtonProps) {
  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = (event) => {
    if (!disabled) blockBlastAudio.playButtonClick();
    onClick?.(event);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "rgba(253,246,234,0.86)",
        border: "1.5px solid rgba(138,125,101,0.34)",
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        color: "#4a4232",
        boxShadow: "0 4px 12px rgba(42,36,24,0.08)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
        opacity: disabled ? 0.55 : 1,
        touchAction: "manipulation",
        ...style,
      }}
      {...props}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
