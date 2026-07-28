import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = {
  variant?: ButtonVariant;
  /** When provided, renders as a Next.js Link instead of a <button>. */
  href?: string;
} & ComponentPropsWithoutRef<"button">;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-background hover:bg-primary/90",
  secondary:
    "border border-primary/20 text-primary hover:bg-primary/[0.04]",
};

/**
 * Shared button used for both primary calls-to-action and secondary/quiet
 * actions across the app. Pass `href` to navigate instead of firing a click
 * handler.
 */
export function Button({
  variant = "primary",
  href,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors ${VARIANT_STYLES[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
