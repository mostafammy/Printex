import React from "react";
import ar from "~/messages/ar.json";

interface AuthDividerProps {
  readonly label?: string;
}

/**
 * Accessible divider with centered label.
 */
export function AuthDivider({ label = ar.ui.orDivider }: AuthDividerProps) {
  return (
    <div className="relative my-1 flex items-center justify-center">
      <div className="w-full border-t border-border" />
      <span className="absolute bg-card px-2 text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
