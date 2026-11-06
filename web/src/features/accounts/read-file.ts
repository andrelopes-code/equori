function viaReader(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("read failed"));
    };
    reader.readAsArrayBuffer(file);
  });
}

// The bytes of a file the reader chose. A File of another realm than the page's (a test
// environment's) may refuse arrayBuffer; FileReader still reads it.
export async function readBytes(file: Blob): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch (error) {
    if (typeof FileReader === "undefined") throw error;
    return viaReader(file);
  }
}

// As the server's charset.Decode: a named encoding, or auto, which keeps valid UTF-8 and reads
// anything else as Windows-1252.
export async function readText(file: Blob, encoding = "auto"): Promise<string> {
  const bytes = await readBytes(file);
  if (encoding !== "auto") return new TextDecoder(encoding).decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
