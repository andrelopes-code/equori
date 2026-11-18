import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProblemError } from "@/api/problem";
import type { AssistantFile } from "@/features/assistant/api";
import { useComposerFiles } from "@/features/assistant/panel/use-composer-files";

describe("useComposerFiles", () => {
  it("uploads a file with its progress, then holds it stored", async () => {
    const done = deferred<AssistantFile>();
    let report: (percent: number) => void = () => undefined;
    const upload = vi.fn((_: File, onProgress: (p: number) => void) => {
      report = onProgress;
      return done.promise;
    });
    const { result } = renderHook(() =>
      useComposerFiles({ upload, remove: vi.fn() }),
    );

    act(() => {
      result.current.add([file("a.ofx")], []);
    });
    act(() => {
      report(40);
    });

    expect(result.current.files[0]?.progress).toBe(40);
    expect(result.current.uploading).toBe(true);

    await act(async () => {
      done.resolve(stored("f1"));
      await done.promise;
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.stored.map((f) => f.id)).toEqual(["f1"]);
  });

  it("keeps a failed file with its cause and sends it again on retry", async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemError({
          type: "about:blank",
          title: "x",
          status: 413,
          code: "file_too_large",
        }),
      )
      .mockResolvedValueOnce(stored("f2"));
    const { result } = renderHook(() =>
      useComposerFiles({ upload, remove: vi.fn() }),
    );

    await act(async () => {
      result.current.add([file("big.pdf")], []);
      await Promise.resolve();
    });

    expect(result.current.files[0]?.failure).toBe(
      "assistant.files.failed.size",
    );

    const key = result.current.files[0]?.key ?? "";
    await act(async () => {
      result.current.retry(key);
      await Promise.resolve();
    });

    expect(result.current.files[0]?.failure).toBeUndefined();
    expect(result.current.stored.map((f) => f.id)).toEqual(["f2"]);
  });

  it("lists a file the selection rules refused, without uploading it", () => {
    const upload = vi.fn();
    const { result } = renderHook(() =>
      useComposerFiles({ upload, remove: vi.fn() }),
    );

    act(() => {
      result.current.add(
        [],
        [
          {
            key: "r",
            name: "a.zip",
            size: 3,
            type: "application/zip",
            reason: "type",
          },
        ],
      );
    });

    expect(upload).not.toHaveBeenCalled();
    expect(result.current.files[0]?.file.name).toBe("a.zip");
    expect(result.current.files[0]?.failure).toBe(
      "assistant.files.failed.kind",
    );
  });

  it("deletes a stored file the member removes", async () => {
    const remove = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() =>
      useComposerFiles({
        upload: () => Promise.resolve(stored("f3")),
        remove,
      }),
    );

    await act(async () => {
      result.current.add([file("a.txt")], []);
      await Promise.resolve();
    });
    act(() => {
      result.current.drop(result.current.files[0]?.key ?? "");
    });

    expect(remove).toHaveBeenCalledWith("f3");
    expect(result.current.files).toEqual([]);
  });
});

function file(name: string) {
  return new File(["x"], name);
}

function stored(id: string): AssistantFile {
  return {
    id,
    name: "a",
    kind: "ofx",
    size: 1,
    created_at: "2026-11-18T12:00:00Z",
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });

  return { promise, resolve };
}
