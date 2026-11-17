import type { MessageKey } from "@/i18n/catalog.en";
import { artKeys } from "@/ui/card-face/art";
import type { Brand } from "@/ui/card-face/brand";
import type { CardFaceProps } from "@/ui/card-face/card-face";

export type PreviewWidth = "w96" | "w200" | "w220" | "w320" | "w380" | "w420";

export interface PreviewItem {
  key: string;
  width: PreviewWidth;
  face: CardFaceProps;
}

export interface PreviewSectionData {
  title: MessageKey;
  items: PreviewItem[];
}

const title = "Nubank Ultravioleta";
const holder = "André Lopes";
const lastFour = "4821";
const purple = "#820ad1";
const carbon = "#1b1b1f";

// The twelve preset colours of the card colour picker.
const presetColours = [
  "#820ad1",
  "#ec7000",
  "#ff7a00",
  "#cc092f",
  "#fce300",
  "#0b4ea2",
  "#00875f",
  "#e5398d",
  "#17171a",
  "#3a3d44",
  "#c4c8cf",
  "#b8923a",
];
const networks = ["visa", "mastercard", "amex", "elo", "hipercard"];
const brands: Brand[] = ["auto", "plate", "name", "none"];
const widths: PreviewWidth[] = ["w420", "w320", "w220", "w96"];

const base: CardFaceProps = { title, holder, lastFour, color: purple };

export const studioFace: CardFaceProps = {
  title,
  holder,
  lastFour,
  network: "mastercard",
};

function item(key: string, width: PreviewWidth, face: CardFaceProps) {
  return { key, width, face };
}

export const stackFaces = [
  { id: "plum", face: { ...base, color: purple, art: "aurora" } },
  { id: "orange", face: { ...base, color: "#ec7000", art: "waves" } },
  { id: "blue", face: { ...base, color: "#0b4ea2", art: "orbits" } },
  { id: "carbon", face: { ...base, color: carbon, art: "carbon" } },
];

export const sections: PreviewSectionData[] = [
  {
    title: "cardFacePreview.arts",
    items: artKeys.map((art) =>
      item(art, "w320", { ...base, art, network: "mastercard" }),
    ),
  },
  {
    title: "cardFacePreview.colours",
    items: presetColours.map((color, index) =>
      item(color, "w320", {
        ...base,
        color,
        art: "plain",
        chip: index % 2 === 0 ? "gold" : "silver",
      }),
    ),
  },
  {
    title: "cardFacePreview.networks",
    items: [
      ...networks.map((network) =>
        item(network, "w320", { ...base, color: carbon, network }),
      ),
      item("none", "w320", { ...base, color: carbon }),
    ],
  },
  {
    title: "cardFacePreview.states",
    items: [
      item("virtual", "w320", { ...base, virtual: true }),
      item("inactive", "w320", { ...base, active: false }),
      item("loading", "w320", { ...base, loading: true }),
      item("vertical", "w200", { ...base, orientation: "vertical" }),
      item("long-title", "w320", { ...base, title: "T".repeat(60) }),
      item("long-holder", "w320", { ...base, holder: "H".repeat(40) }),
    ],
  },
  {
    title: "cardFacePreview.brand",
    items: brands.map((brand) =>
      item(brand, "w320", { ...base, brand, institutionName: "Nubank" }),
    ),
  },
  {
    title: "cardFacePreview.sizes",
    items: widths.map((width) => item(width, width, base)),
  },
];
