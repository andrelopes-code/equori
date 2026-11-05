import { errorText, ProblemError } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type ArchiveImport = components["schemas"]["ArchiveImport"];

// ADR 021, V4: an archive of a later version names both versions and the way out.
export function importError(caught: unknown, t: TFunction): string {
  const p = caught instanceof ProblemError ? caught.problem : undefined;
  return p?.code === "archive_too_new" &&
    p.archive_version !== undefined &&
    p.instance_version !== undefined
    ? t("import.tooNew", {
        archive: p.archive_version,
        instance: p.instance_version,
      })
    : errorText(caught, t);
}

// The rows written, then what became of the credentials and the provider keys of the archive
// (export design C7, T7).
export function importDone(result: ArchiveImport, t: TFunction): string {
  const sentences = [
    t("import.done", {
      rows: result.tables.reduce((sum, table) => sum + table.rows, 0),
      version: result.archive_version,
    }),
  ];
  if (result.credentials_restored > 0) {
    sentences.push(
      t("import.credentialsRestored", { count: result.credentials_restored }),
    );
  }
  if (result.provider_keys_restored > 0) {
    sentences.push(
      t("import.providerKeysRestored", {
        count: result.provider_keys_restored,
      }),
    );
  }
  if (
    result.credentials_in_archive &&
    result.credentials_restored + result.provider_keys_restored === 0
  ) {
    sentences.push(t("import.credentialsSkipped"));
  }
  return sentences.join(" ");
}

// The import asks for the passphrase of an archive that carries credentials (export design C5).
export function asksForPassphrase(caught: unknown): boolean {
  return (
    caught instanceof ProblemError &&
    caught.problem.code === "passphrase_required"
  );
}
