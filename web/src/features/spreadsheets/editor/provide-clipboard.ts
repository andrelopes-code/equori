import { copyText } from "@/ui/runtime/copy-text";

// A page over plain http has no navigator.clipboard, and Univer copies the address of a link with
// navigator.clipboard.writeText. Only writeText is given: without readText and write, Univer
// copies and pastes cells through the events of the browser.
export function provideClipboard(): void {
  if ("clipboard" in navigator) return;

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text: string) => copyText(text, document.body) },
  });
}
