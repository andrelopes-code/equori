// The elements whose long press opens a browser menu (open in a new tab, copy the link, download
// the image). The list mirrors the controls app.css makes unselectable, plus images.
const CONTROLS = [
  "a[href]",
  "button",
  "summary",
  "img",
  "svg",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="switch"]',
].join(",");

function isTouch(event: MouseEvent): boolean {
  const { pointerType } = event as MouseEvent & { pointerType?: string };
  if (pointerType !== undefined) return pointerType === "touch";
  return window.matchMedia("(pointer: coarse)").matches;
}

// -webkit-touch-callout reaches only iOS: Chrome on Android opens its menu on the contextmenu
// event, so the event is cancelled for a touch long press over a control. A mouse right click,
// text and fields keep the browser menu, which holds copy, paste and the selection toolbar.
export function guardTouchContextMenu(target: Document): () => void {
  const onContextMenu = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (isTouch(event) && event.target.closest(CONTROLS) !== null) {
      event.preventDefault();
    }
  };
  target.addEventListener("contextmenu", onContextMenu);
  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
  };
}
