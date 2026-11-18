import { describe, expect, it } from "vitest";

import { ProblemError } from "@/api/problem";
import { fileFailure } from "@/features/assistant/panel/file-failure";

function problem(code: string) {
  return new ProblemError({
    type: "about:blank",
    title: code,
    status: 400,
    code,
  });
}

describe("fileFailure", () => {
  it.each([
    ["type", "assistant.files.failed.kind"],
    ["size", "assistant.files.failed.size"],
    ["maxFiles", "assistant.files.failed.count"],
    ["totalSize", "assistant.files.failed.full"],
    [problem("file_kind_unsupported"), "assistant.files.failed.kind"],
    [problem("file_too_large"), "assistant.files.failed.size"],
    [problem("conversation_files_full"), "assistant.files.failed.full"],
    [problem("internal"), "assistant.files.failed.network"],
    [new Error("offline"), "assistant.files.failed.network"],
  ])("%s reads %s", (cause, key) => {
    expect(fileFailure(cause)).toBe(key);
  });
});
