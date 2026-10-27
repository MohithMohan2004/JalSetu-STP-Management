import { useId } from "react";

/** ReFlow mark: a water drop whose outline curls back into itself — treated water, returned to use. */
export function BrandMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: `0 0 ${size}px` }}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset=".55" stopColor="#1463d6" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id={`fg-${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#d7fbf5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#bg-${id})`} />
      <path d="M31.5 15.5C29 12.2 26.6 9.6 24 7c-5.8 6-11 12.5-11 19.5a11 11 0 0 0 22 0" fill="none" stroke={`url(#fg-${id})`} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M29.5 26.5a5.5 5.5 0 1 1-5.5-5.5" fill="none" stroke={`url(#fg-${id})`} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="35" cy="21" r="2.2" fill="#fff" />
    </svg>
  );
}

/** The product name, set in Sora: "Re" in ink, "Flow" in the brand gradient. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="ReFlow">
      Re<span>Flow</span>
    </span>
  );
}
