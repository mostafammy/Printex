export type LoadingPhase = "hidden" | "awakening" | "processing" | "completing";

export interface LoadingGeometryProps {
  phase?: LoadingPhase;
  reducedMotion?: boolean;
}

/**
 * Pure presentational geometry component for the Printex loading experience.
 * Contains no internal state; renders the ambient glow, the core printed plate,
 * and the three independent accent orbiting dots.
 */
export function LoadingGeometry({
  phase = "processing",
  reducedMotion = false,
}: LoadingGeometryProps) {
  const isCompleting = phase === "completing";

  return (
    <div
      className="loading-scene"
      data-phase={phase}
      data-reduced-motion={reducedMotion ? "true" : undefined}
      aria-hidden="true"
    >
      {/* 1. Ambient blurred radial glow behind everything */}
      <div className="loading-ambient" />

      {/* 2. Core plate evoking a printed sheet / plate */}
      <div
        className={`loading-core ${
          isCompleting ? "loading-core--completing" : "loading-core--drift"
        }`}
      />

      {/* 3. Three accent dots orbiting with distinct periods, directions, and angles */}
      <div
        className={`loading-dot loading-dot-a ${
          isCompleting ? "loading-dot-a--completing" : ""
        }`}
      />
      <div
        className={`loading-dot loading-dot-b ${
          isCompleting ? "loading-dot-b--completing" : ""
        }`}
      />
      <div
        className={`loading-dot loading-dot-c ${
          isCompleting ? "loading-dot-c--completing" : ""
        }`}
      />
    </div>
  );
}
