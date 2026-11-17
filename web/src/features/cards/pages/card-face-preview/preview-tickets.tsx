import styles from "@/features/cards/card-tile/card-tile.module.css";
import { PreviewSection } from "@/features/cards/pages/card-face-preview/preview-section";
import { ticketSamples } from "@/features/cards/pages/card-face-preview/preview-ticket-data";
import { PreviewTicketTile } from "@/features/cards/pages/card-face-preview/preview-ticket-tile";
import { useToday } from "@/i18n/today";

// The statement ticket in each of its states, in the grid of the card list.
export function PreviewTickets() {
  const today = useToday();
  const samples = ticketSamples(today);

  return (
    <PreviewSection title="cardFacePreview.tickets">
      <div className={styles.grid}>
        {samples.map((sample) => (
          <PreviewTicketTile key={sample.key} sample={sample} />
        ))}
      </div>
    </PreviewSection>
  );
}
