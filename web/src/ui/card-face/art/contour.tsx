import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

const blob = "M60 0C60 35 30 58-5 55S-62 30-58-8-30-60 8-56 60-35 60 0Z";

const rings = [...ringsAt(318, 64, 8, 0), ...ringsAt(58, 236, 6, 40)];

export function Contour() {
  return (
    <ArtCanvas>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {rings.map((ring) => (
          <path
            key={ring.transform}
            vectorEffect="non-scaling-stroke"
            transform={ring.transform}
            strokeOpacity={ring.opacity}
            d={blob}
          />
        ))}
      </g>
    </ArtCanvas>
  );
}

function ringsAt(x: number, y: number, count: number, rotation: number) {
  return Array.from({ length: count }, (_, k) => ({
    transform: [
      `translate(${String(x)} ${String(y)})`,
      `rotate(${String(rotation + k * 7)})`,
      `scale(${(0.45 + k * 0.42).toFixed(2)})`,
    ].join(" "),
    opacity: (0.24 - k * 0.02).toFixed(2),
  }));
}
