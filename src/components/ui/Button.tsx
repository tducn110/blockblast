import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, #f08a48 0%, #e87432 100%)",
    border: "2px solid #b85a22",
    color: "#fffaf0",
    boxShadow: "0 8px 18px rgba(232,116,50,0.32)",
  },
  secondary: {
    background: "linear-gradient(180deg, #f7d77c 0%, #f0b840 100%)",
    border: "2px solid #c8920c",
    color: "#2a2418",
    boxShadow: "0 8px 18px rgba(200,146,12,0.25)",
  },
  ghost: {
    background: "rgba(253,246,234,0.86)",
    border: "1.5px solid rgba(138,125,101,0.38)",
    color: "#2a2418",
    boxShadow: "0 4px 12px rgba(42,36,24,0.08)",
  },
  danger: {
    background: "linear-gradient(180deg, #d95645 0%, #bf382e 100%)",
    border: "2px solid #9f281f",
    color: "#fffaf0",
    boxShadow: "0 8px 18px rgba(191,56,46,0.25)",
  },
};

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { minHeight: 34, padding: "7px 14px", fontSize: 12 },
  md: { minHeight: 40, padding: "9px 18px", fontSize: 14 },
  lg: { minHeight: 46, padding: "11px 22px", fontSize: 15 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", style, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      style={{
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontWeight: 800,
        letterSpacing: 0,
        cursor: props.disabled ? "not-allowed" : "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
        opacity: props.disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        touchAction: "manipulation",
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
