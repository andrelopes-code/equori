import { monogram } from "@/features/accounts";
import { brandOf } from "@/ui/card-face/brand";
import type { Brand } from "@/ui/card-face/brand";
import styles from "@/ui/card-face/card-face.module.css";
import { useLogoTraits } from "@/ui/card-face/use-logo-traits";

interface CardFaceBrandProps {
  brand: Brand | undefined;
  logo: string | undefined;
  institutionName: string | undefined;
  title: string;
  color: string;
}

export function CardFaceBrand({
  brand,
  logo,
  institutionName,
  title,
  color,
}: CardFaceBrandProps) {
  const traits = useLogoTraits(logo);
  const drawing = brandOf(brand ?? "auto", logo !== undefined, traits, color);

  if (drawing.kind === "none") {
    return null;
  }

  if (drawing.kind === "name") {
    // A title that already names the institution is not preceded by the same name.
    if (
      institutionName === undefined ||
      title.toLowerCase().includes(institutionName.toLowerCase())
    ) {
      return null;
    }

    return <span className={styles.brandName}>{institutionName}</span>;
  }

  if (drawing.kind === "plate") {
    return (
      <span className={styles.tile} data-kind="plate" data-tone={drawing.tone}>
        {logo === undefined ? (
          monogram(institutionName ?? title)
        ) : (
          <img className={styles.logo} src={logo} alt="" />
        )}
      </span>
    );
  }

  return (
    <span className={styles.tile} data-kind={drawing.kind}>
      <img className={styles.logo} src={logo} alt="" />
    </span>
  );
}
