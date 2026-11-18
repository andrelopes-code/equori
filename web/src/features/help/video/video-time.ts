import { numberFormatter } from "@/i18n/format";

// A second of the video as minutes and seconds ("0:04"), in the digits of the active tag.
export function videoTime(seconds: number, locale: string): string {
  const whole = Math.floor(seconds);
  const minutes = numberFormatter(locale).format(Math.floor(whole / 60));
  const rest = numberFormatter(locale, { minimumIntegerDigits: 2 }).format(
    whole % 60,
  );

  return `${minutes}:${rest}`;
}
