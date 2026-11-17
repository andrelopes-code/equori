import type { ArtShape } from "@/features/accounts/kind-chooser/kind-art";
import styles from "@/features/accounts/kind-chooser/kind-art.module.css";
import { cx } from "@/ui/cx";

interface KindShapesProps {
  shapes: readonly ArtShape[];
}

export function KindShapes({ shapes }: KindShapesProps) {
  return shapes.map((shape, index) => {
    const className = cx(...shape.paint.map((paint) => styles[paint]));

    if (shape.el === "rect") {
      return (
        <rect
          key={index}
          className={className}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
        />
      );
    }

    if (shape.el === "circle") {
      return (
        <circle
          key={index}
          className={className}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
        />
      );
    }

    return <path key={index} className={className} d={shape.d} />;
  });
}
