import { ButtonHTMLAttributes } from "react";

interface GoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function GoldButton({
  children,
  fullWidth,
  className = "",
  ...props
}: GoldButtonProps) {
  return (
    <button
      className={`btn-gold text-sm font-semibold ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
