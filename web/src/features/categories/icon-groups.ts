import type { CategoryIconName } from "@/features/categories/category-paths";

export interface IconGroup {
  key:
    | "home"
    | "food"
    | "transport"
    | "health"
    | "education"
    | "leisure"
    | "shopping"
    | "work"
    | "money"
    | "family"
    | "travel"
    | "other";
  icons: readonly CategoryIconName[];
}

// The curated icons by the topic of spending they draw, in the order the picker lists them.
export const iconGroups: readonly IconGroup[] = [
  {
    key: "home",
    icons: [
      "house",
      "building-2",
      "key-round",
      "sofa",
      "lamp",
      "wrench",
      "hammer",
      "zap",
      "droplet",
      "flame",
      "wifi",
      "smartphone",
      "tv",
    ],
  },
  {
    key: "food",
    icons: [
      "shopping-cart",
      "shopping-basket",
      "utensils",
      "coffee",
      "pizza",
      "croissant",
      "apple",
      "wine",
      "beer",
    ],
  },
  {
    key: "transport",
    icons: [
      "car",
      "fuel",
      "bus",
      "train-front",
      "bike",
      "plane",
      "circle-parking",
      "car-taxi-front",
    ],
  },
  {
    key: "health",
    icons: ["heart-pulse", "pill", "stethoscope", "dumbbell", "hospital"],
  },
  { key: "education", icons: ["graduation-cap", "book-open", "school"] },
  {
    key: "leisure",
    icons: ["film", "music", "gamepad-2", "ticket", "palette", "party-popper"],
  },
  {
    key: "shopping",
    icons: ["shirt", "gift", "shopping-bag", "package", "scissors"],
  },
  { key: "work", icons: ["receipt", "briefcase", "laptop", "cloud", "globe"] },
  {
    key: "money",
    icons: [
      "landmark",
      "piggy-bank",
      "wallet",
      "credit-card",
      "banknote",
      "coins",
      "percent",
      "trending-up",
      "chart-pie",
      "hand-coins",
      "file-text",
      "shield",
    ],
  },
  {
    key: "family",
    icons: ["baby", "users", "heart", "dog", "cat", "paw-print"],
  },
  { key: "travel", icons: ["luggage", "map", "hotel", "tent"] },
  { key: "other", icons: ["smile", "sparkles", "tag"] },
];
