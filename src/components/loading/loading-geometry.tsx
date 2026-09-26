"use client";

import { useEffect, useRef, useState } from "react";

export type LoadingPhase = "hidden" | "awakening" | "processing" | "completing";

export interface LoadingGeometryProps {
  phase?: LoadingPhase;
  reducedMotion?: boolean;
}

interface Shockwave {
  id: number;
  x: number;
  y: number;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
}

const CRAFT_PHRASES = [
  "معايرة أطياف ألوان الطباعة بدقة متناهية...",
  "تجهيز خوارزميات التوزيع والفرز الذكي...",
  "مزامنة خطوط الإنتاج وجودة الورق الفاخر...",
  "التحقق من علامات التطابق وتوازن الأحبار...",
];

/**
 * UI Progress Master geometry and interactive HUD component for Printex.
 * Features:
 * - CMYK 4-photon orbital harmonic system (Cyan, Magenta, Yellow, Indigo/Key)
 * - Precision VisionOS optical frosted glass plate with registration reticle
 * - Interactive 3D perspective tilt reacting smoothly to pointer movement
 * - Tactile click/tap shockwaves and CMYK micro-sparkle bursts (dopamine toy)
 * - Dynamic liquid neon progress bar with tabular monospace percentage counter
 * - Rotating Arabic printcraft micro-copy with smooth transitions
 * - Completion supernova burst and lock-in checkmark
 * - Strict reduced-motion fallback and leak-free timer cleanup
 */
export function LoadingGeometry({
  phase = "processing",
  reducedMotion = false,
}: LoadingGeometryProps) {
  const isCompleting = phase === "completing";

  const [progress, setProgress] = useState(phase === "completing" ? 100 : 18);
  const [craftIndex, setCraftIndex] = useState(0);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [inkDrops, setInkDrops] = useState(0);

  const sceneRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup all pending timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const timeouts = timeoutsRef.current;
    return () => {
      isMountedRef.current = false;
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.length = 0;
    };
  }, []);

  // Drive progress bar and rotating craft phrases
  useEffect(() => {
    if (phase === "completing") {
      setProgress(100);
      return;
    }

    if (phase === "awakening") {
      setProgress(24);
      return;
    }

    // Processing phase: smoothly increment progress up to 96%
    const progressInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      setProgress((prev) => {
        if (prev >= 96) return 96;
        const remaining = 96 - prev;
        const step = Math.max(0.4, remaining * 0.08);
        return Math.min(96, prev + step);
      });
    }, 100);

    // Rotate Arabic craft copy every 1.8s
    const phraseInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      setCraftIndex((prev) => (prev + 1) % CRAFT_PHRASES.length);
    }, 1800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(phraseInterval);
    };
  }, [phase]);

  // Interactive 3D Perspective Parallax Tilt
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !sceneRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    sceneRef.current.style.setProperty("--tilt-x", x.toFixed(3));
    sceneRef.current.style.setProperty("--tilt-y", y.toFixed(3));
  };

  const handlePointerLeave = () => {
    if (!sceneRef.current) return;
    sceneRef.current.style.setProperty("--tilt-x", "0");
    sceneRef.current.style.setProperty("--tilt-y", "0");
  };

  // Tactile Click / Tap Shockwave & CMYK Sparkles (Dopamine Booster)
  const handleInteract = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;

    const id = Date.now() + Math.random();
    const x = e.clientX;
    const y = e.clientY;

    // Spawn expanding shockwave
    setShockwaves((prev) => [...prev.slice(-3), { id, x, y }]);
    const tShock = setTimeout(() => {
      if (!isMountedRef.current) return;
      setShockwaves((prev) => prev.filter((s) => s.id !== id));
    }, 700);
    timeoutsRef.current.push(tShock);

    // Spawn 6 CMYK radiant sparkles
    const cmykColors = ["#00f2fe", "#ff0844", "#ffb300", "#7928ca"];
    const burstParticles: Sparkle[] = Array.from({ length: 6 }).map((_, i) => {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distance = 40 + Math.random() * 50;
      return {
        id: id + i + 1,
        x,
        y,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        color: cmykColors[i % cmykColors.length] ?? "#00f2fe",
      };
    });

    setSparkles((prev) => [...prev.slice(-12), ...burstParticles]);
    const tSpark = setTimeout(() => {
      if (!isMountedRef.current) return;
      setSparkles((prev) => prev.filter((s) => s.id <= id));
    }, 650);
    timeoutsRef.current.push(tSpark);

    setInkDrops((prev) => prev + 1);
  };

  const activePhrase = isCompleting
    ? "اكتمل التجهيز — مرحباً بك في برينتكس!"
    : CRAFT_PHRASES[craftIndex];

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full h-full cursor-pointer select-none"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handleInteract}
    >
      {/* Interactive Click Shockwaves */}
      {shockwaves.map((s) => (
        <span
          key={s.id}
          className="loading-shockwave"
          style={{ left: `${s.x}px`, top: `${s.y}px` }}
          aria-hidden="true"
        />
      ))}

      {/* Interactive Micro-Sparkles */}
      {sparkles.map((sp) => (
        <span
          key={sp.id}
          className="loading-sparkle"
          style={
            {
              left: `${sp.x}px`,
              top: `${sp.y}px`,
              backgroundColor: sp.color,
              boxShadow: `0 0 10px ${sp.color}, 0 0 20px ${sp.color}`,
              "--tx": `${sp.tx}px`,
              "--ty": `${sp.ty}px`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      ))}

      {/* 3D Geometry Stage */}
      <div
        ref={sceneRef}
        className="loading-scene"
        data-phase={phase}
        data-reduced-motion={reducedMotion ? "true" : undefined}
        aria-hidden="true"
      >
        {/* 1. Ambient blurred CMYK prismatic aurora */}
        <div className="loading-ambient" />

        {/* 2. Completion supernova shockwave */}
        {isCompleting && !reducedMotion && (
          <div className="loading-supernova" />
        )}

        {/* 3. Core precision optical plate */}
        <div
          className={`loading-core ${
            isCompleting ? "loading-core--completing" : "loading-core--drift"
          }`}
        >
          {/* Printer's registration reticle / crosshair */}
          <div
            className={`loading-reticle ${
              isCompleting ? "opacity-0" : "opacity-80"
            }`}
          >
            <svg
              viewBox="0 0 40 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle
                cx="20"
                cy="20"
                r="13"
                strokeDasharray="2.5 2.5"
                opacity="0.5"
              />
              <circle cx="20" cy="20" r="6" opacity="0.8" />
              <circle cx="20" cy="20" r="1.8" fill="currentColor" />
              <line x1="20" y1="2" x2="20" y2="11" />
              <line x1="20" y1="29" x2="20" y2="38" />
              <line x1="2" y1="20" x2="11" y2="20" />
              <line x1="29" y1="20" x2="38" y2="20" />
            </svg>
          </div>

          {/* Completion checkmark */}
          {isCompleting && (
            <div className="loading-checkmark">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>

        {/* 4. Four accent dots orbiting with distinct CMYK periods and trajectories */}
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
        <div
          className={`loading-dot loading-dot-d ${
            isCompleting ? "loading-dot-d--completing" : ""
          }`}
        />
      </div>

      {/* Luminous Dopamine HUD */}
      <div className="loading-hud" aria-hidden="true">
        {/* Brand Shimmer */}
        <div className="loading-brand font-black">برينتكس</div>

        {/* Liquid Neon Progress Bar */}
        <div className="loading-progress-track">
          <div
            className="loading-progress-bar"
            style={{ width: `${Math.round(progress)}%` }}
          >
            <span className="loading-progress-flare" />
          </div>
        </div>

        {/* Meta status & percentage */}
        <div className="loading-hud-meta">
          <span className="loading-percentage">{Math.round(progress)}%</span>
          <span className="loading-status-text">{activePhrase}</span>
        </div>

        {/* Interactive Tap Dopamine Chip */}
        {!reducedMotion && (
          <div className="loading-interactive-chip">
            {inkDrops > 0 ? (
              <span>⚡ طاقة الأحبار: +{inkDrops}</span>
            ) : (
              <span>✨ انقر للشحن اللوني والتفاعل ✨</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
