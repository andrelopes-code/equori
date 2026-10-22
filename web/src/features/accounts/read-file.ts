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

export async function readText(file: Blob): Promise<string> {
  return new TextDecoder().decode(await readBytes(file));
}
