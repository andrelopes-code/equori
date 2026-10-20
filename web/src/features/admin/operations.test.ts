import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { operations } from "@/features/admin/operations";

// jsdom replaces the URL class, so readFileSync receives a path string instead of a URL object.
// Vite serves a module outside web/ under /@fs/, which is not part of the file's path.
const contract = readFileSync(
  new URL("../../../../api/openapi.yaml", import.meta.url).pathname.replace(
    /^\/@fs\//,
    "/",
  ),
  "utf8",
);

// The session's own operations, and the ones that send or return a file, which the
// console's JSON forms cannot carry.
const outside = new Set([
  "createSession",
  "deleteSession",
  "importFile",
  "importPrices",
  "createAttachment",
  "getAttachmentContent",
]);

describe("operations", () => {
  it("holds every operation of the contract outside the session and file transfers", () => {
    const declared = [...contract.matchAll(/operationId: (\w+)/g)].map(
      (match) => match[1] ?? "",
    );
    const held = new Set(
      Object.values(operations).flatMap((ops) => ops.map((op) => op.id)),
    );
    expect(declared.filter((id) => !outside.has(id) && !held.has(id))).toEqual(
      [],
    );
    expect([...held].filter((id) => !declared.includes(id))).toEqual([]);
  });
});
