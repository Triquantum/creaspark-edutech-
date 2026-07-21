import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-card",
  ghost: "bg-transparent text-ink hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5",
  danger: "bg-danger text-white hover:brightness-95",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium
        transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]
        ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
