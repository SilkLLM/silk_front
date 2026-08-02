/**
 * Logo.tsx
 * The SilkLLM mark and wordmark.
 *
 * The mark's branches run from gold through to a bright yellow, and that yellow
 * disappears against a light surface. So the mark always sits on the brand's
 * dark tile, which is also how it appears as an installed app icon: one lockup,
 * identical in both themes and on the home screen.
 */

// File: silkllm-frontend/src/components/Logo.tsx

import React from "react";
import clsx from "clsx";

/** The mark on its dark tile. Use anywhere an app icon would go. */
export function LogoMark({ size = 28, className, rounded = "rounded-lg" }: {
  size?: number;
  className?: string;
  /** Tailwind radius class. The tile is square, so this controls the shape. */
  rounded?: string;
}) {
  return (
    <span
      className={clsx("inline-flex items-center justify-center shrink-0 overflow-hidden", rounded, className)}
      style={{ width: size, height: size, background: "#16181A" }}
    >
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        width={Math.round(size * 0.74)}
        height={Math.round(size * 0.74)}
        className="select-none pointer-events-none"
        draggable={false}
      />
    </span>
  );
}

/** Mark plus wordmark, as used in the sidebar, the top nav and the auth pages. */
export default function Logo({ size = 28, className, showWord = true, wordClassName }: {
  size?: number;
  className?: string;
  showWord?: boolean;
  wordClassName?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-2 min-w-0", className)}>
      <LogoMark size={size} />
      {showWord && (
        <span className={clsx("font-display font-bold tracking-tight text-ink truncate", wordClassName)}>
          SilkLLM
        </span>
      )}
      <span className="sr-only">SilkLLM</span>
    </span>
  );
}

// EOF silkllm-frontend/src/components/Logo.tsx
