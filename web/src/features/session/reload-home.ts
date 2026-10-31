// HA32: a reload drops every query cache and reads every per-book key under the new book.
export function reloadHome(): void {
  window.location.assign("/");
}
