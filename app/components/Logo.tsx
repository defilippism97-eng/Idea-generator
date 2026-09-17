"use client";

import { useId } from "react";

/**
 * Marchio Vantage: la "V" angolare (visione/direzione) con una faccetta
 * dorata e la stella geometrica a quattro punte (precisione).
 */
export function Logo({ size = 32 }: { size?: number }) {
  const id = useId();
  const grad = `vantage-grad-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Vantage"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={grad} x1="4" y1="4" x2="26" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5345A4" />
          <stop offset="1" stopColor="#3F236E" />
        </linearGradient>
      </defs>

      {/* Corpo della V */}
      <path d="M4.5 5H11L16 18L21 5H27.5L18.6 26H13.4L4.5 5Z" fill={`url(#${grad})`} />

      {/* Faccetta dorata sul braccio sinistro */}
      <path d="M4.5 5H11L13.2 11H6.7L4.5 5Z" fill="#D4A757" />

      {/* Stella a quattro punte */}
      <path
        d="M25 17.6Q25.9 21 29 21.9Q25.9 22.8 25 26.2Q24.1 22.8 21 21.9Q24.1 21 25 17.6Z"
        fill="#D4A757"
      />
    </svg>
  );
}

/** Marchio + logotipo, per header e sidebar. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="font-display text-[1.35rem] leading-none font-bold tracking-tight">Vantage</span>
    </span>
  );
}
