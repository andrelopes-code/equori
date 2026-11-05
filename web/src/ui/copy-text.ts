// The Clipboard API exists only in a secure context (HTTPS or localhost). On any other address
// the page falls back to selecting a text area and the browser's copy command.
export async function copyText(text: string, host: HTMLElement): Promise<void> {
  if (window.isSecureContext && "clipboard" in navigator) {
    await navigator.clipboard.writeText(text);
    return;
  }

  copyBySelection(text, host);
}

// The text area joins the host, not the body: a modal dialog makes the rest of the page inert,
// and an inert element cannot be selected.
function copyBySelection(text: string, host: HTMLElement): void {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.insetBlockStart = "0";
  area.style.opacity = "0";
  host.append(area);

  try {
    area.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only copy path outside a secure context
    if (!document.execCommand("copy")) throw new Error("copy refused");
  } finally {
    area.remove();
  }
}
