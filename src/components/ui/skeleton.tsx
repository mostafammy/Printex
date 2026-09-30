// Skeleton — 092-performance T050 (investigation §6.2 / §17 Fix B polish).
//
// One honest loading block: `aria-busy` for assistive tech, a muted base
// (`bg-muted` by default — override per site with a className), and the
// `.skeleton` shimmer from globals.css (a glint sweeping via background
// position, ~1.5s linear, RTL-safe, fully disabled under
// `prefers-reduced-motion: reduce`). Never renders operational data — a
// fallback must not look like content (FR-007, SR-003).

import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-busy="true"
      data-slot="skeleton"
      className={cn("skeleton rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
