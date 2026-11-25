import { useCallback, useEffect, useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import {
  deleteAssistantFile,
  uploadAssistantFile,
} from "@/features/assistant/api";
import type { AssistantFile } from "@/features/assistant/api";
import { fileFailure } from "@/features/assistant/panel/file-failure";
import type { MessageKey } from "@/i18n/catalog.en";
import { newId } from "@/ui/runtime/new-id";

// One file of the composer: uploading with its progress, stored with its server record, or
// failed with its cause (FU2, FU3).
export interface ComposerFile {
  key: string;
  file: File;
  progress: number | null;
  stored?: AssistantFile | undefined;
  failure?: MessageKey | undefined;
}

export interface ComposerFileRejection {
  key: string;
  file?: File | undefined;
  name: string;
  size: number;
  type: string;
  reason?: string | undefined;
}

export interface ComposerFilesPorts {
  upload: (
    file: File,
    onProgress: (percent: number) => void,
    signal: AbortSignal,
  ) => Promise<AssistantFile>;
  remove: (id: string) => Promise<void>;
}

// The files of the composer, uploaded to and removed from the assistant's file store.
export function useAssistantFiles() {
  const api = useApi();
  const remove = useCallback(
    (id: string) => deleteAssistantFile(api, id),
    [api],
  );

  return useComposerFiles({ upload: uploadAssistantFile, remove });
}

export function useComposerFiles({ upload, remove }: ComposerFilesPorts) {
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const uploads = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const running = uploads.current;

    return () => {
      for (const controller of running.values()) controller.abort();
    };
  }, []);

  const patch = useCallback((key: string, change: Partial<ComposerFile>) => {
    setFiles((list) =>
      list.map((f) => (f.key === key ? { ...f, ...change } : f)),
    );
  }, []);

  const start = useCallback(
    (key: string, file: File) => {
      const controller = new AbortController();
      uploads.current.set(key, controller);
      patch(key, { progress: 0, failure: undefined });

      upload(
        file,
        (progress) => {
          patch(key, { progress });
        },
        controller.signal,
      )
        .then((stored) => {
          patch(key, { progress: null, stored });
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            patch(key, { progress: null, failure: fileFailure(cause) });
          }
        })
        .finally(() => {
          uploads.current.delete(key);
        });
    },
    [upload, patch],
  );

  const add = useCallback(
    (added: File[], rejected: ComposerFileRejection[]) => {
      const fresh = added.map((file) => ({
        key: newId(),
        file,
        progress: 0,
      }));
      const refused = rejected.map((r) => ({
        key: newId(),
        file: r.file ?? new File([], r.name, { type: r.type }),
        progress: null,
        failure: fileFailure(r.reason),
      }));

      setFiles((list) => [...list, ...fresh, ...refused]);
      for (const f of fresh) start(f.key, f.file);
    },
    [start],
  );

  const drop = useCallback(
    (key: string) => {
      uploads.current.get(key)?.abort();

      const id = files.find((f) => f.key === key)?.stored?.id;
      // An unsent file the server keeps is deleted after 24 hours anyway (Q6).
      if (id !== undefined) void remove(id).catch(() => undefined);

      setFiles((list) => list.filter((f) => f.key !== key));
    },
    [files, remove],
  );

  const retry = useCallback(
    (key: string) => {
      const file = files.find((f) => f.key === key)?.file;
      if (file !== undefined) start(key, file);
    },
    [files, start],
  );

  // After a send the files belong to the message; the composer forgets them.
  const clear = useCallback(() => {
    setFiles([]);
  }, []);

  const stored = files.flatMap((f) =>
    f.stored === undefined ? [] : [f.stored],
  );
  const uploading = files.some((f) => f.progress !== null);

  return { files, stored, uploading, add, drop, retry, clear };
}

export type ComposerFiles = ReturnType<typeof useComposerFiles>;
