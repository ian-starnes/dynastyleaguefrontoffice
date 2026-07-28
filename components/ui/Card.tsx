import type { ComponentPropsWithoutRef } from "react";

/**
 * The app's one surface style: rounded corners, hairline border, soft
 * shadow. Used anywhere content needs to sit "on top of" the background.
 */
export function Card({
  className = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={`rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
