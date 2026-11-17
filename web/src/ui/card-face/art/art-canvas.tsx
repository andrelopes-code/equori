import type { ReactNode } from "react";

interface ArtCanvasProps {
  children: ReactNode;
}

export function ArtCanvas({ children }: ArtCanvasProps) {
  return (
    <svg
      viewBox="0 0 400 252"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
