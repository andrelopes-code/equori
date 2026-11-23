// Hands the reader a file made in the browser, under a name without characters a file system
// refuses.
export function downloadFile(
  name: string,
  extension: string,
  content: BlobPart,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");

  link.href = url;
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "spreadsheet"}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
