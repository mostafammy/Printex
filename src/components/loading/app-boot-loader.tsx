"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingExperience } from "./loading-experience";

export interface AppBootLoaderProps {
  children: React.ReactNode;
}

/**
 * AppBootLoader wraps the root application shell.
 * It manages the initial boot lifecycle moment (holding `isBooting` initially true,
 * then transitioning to false after first paint via double requestAnimationFrame).
 * Children are always rendered immediately underneath the overlay.
 */
export function AppBootLoader({ children }: AppBootLoaderProps) {
  const [isBooting, setIsBooting] = useState(true);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Double requestAnimationFrame ensures boot flip fires right after first paint
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = requestAnimationFrame(() => {
        setIsBooting(false);
      });
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <>
      {children}
      <LoadingExperience isLoading={isBooting} />
    </>
  );
}
