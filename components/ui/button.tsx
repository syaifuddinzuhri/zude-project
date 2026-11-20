"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "hero";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm",
  secondary: "glass text-text",
  ghost: "bg-transparent text-text hover:bg-primary-soft/60",
  destructive: "bg-expense text-white",
  hero: "text-white shadow-fab [background:var(--hero)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm" | "icon";
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "pressable inline-flex select-none items-center justify-center gap-2 rounded-btn font-semibold outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        size === "md" && "h-12 px-5 text-[15px]",
        size === "sm" && "h-11 px-4 text-[14px]",
        size === "icon" && "h-11 w-11",
        block && "w-full",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Memproses" /> : children}
    </button>
  );
});
