import { FieldError } from "@slotted/react/field";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useParams } from "@tanstack/react-router";

import { AccountFormHeader } from "@/features/accounts/account-form-header";
import { CsvPreviewTable } from "@/features/accounts/csv-preview-table";
import { CsvProfileSection } from "@/features/accounts/csv-profile-section";
import { ImportActions } from "@/features/accounts/import-actions";
import { ImportFileField } from "@/features/accounts/import-file-field";
import { ImportFormatField } from "@/features/accounts/import-format-field";
import { useImportDraft } from "@/features/accounts/use-import-draft";
import { HelpLink } from "@/features/help";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";

// A statement file into a balance account: an OFX file as it is, a CSV file through the
// account's profile, previewed line by line before anything is sent.
export function ImportPage() {
  const t = useT();
  const { id } = useParams({ from: "/_authed/accounts/$id/import" });
  const state = useImportDraft(id);
  const { account, csv, scale } = state;

  return (
    <Page
      width="wide"
      footer={
        <ImportActions
          id={id}
          ready={state.ready}
          busy={state.busy}
          onSubmit={() => void state.submit()}
        />
      }
    >
      <AccountFormHeader
        title={t("importFile.title")}
        subtitle={
          account.data === undefined
            ? t("importFile.subtitle")
            : t("importFile.subtitleOf", { name: account.data.name })
        }
        back={{ to: "/accounts/$id", params: { id } }}
        backLabel={account.data?.name ?? t("nav.accounts")}
        actions={<HelpLink page="import-statement" />}
      />
      <PageBody>
        <Stack gap={10}>
          <FormLayout>
            <ImportFileField
              files={state.files}
              refusal={state.refusal}
              error={state.error}
              onFilesChange={state.changeFiles}
              onReject={state.rejectFiles}
            />

            {state.file !== undefined && (
              <ImportFormatField
                format={state.format}
                onFormatChange={state.changeFormat}
              />
            )}
            {csv !== null && (
              <CsvProfileSection
                value={csv.draft}
                onChange={state.setEdited}
                headers={csv.preview.headers}
              />
            )}
          </FormLayout>

          {csv !== null && (
            <Stack gap={2}>
              <CsvPreviewTable
                preview={csv.preview}
                currency={csv.currency}
                scale={scale === null ? 2 : scale(csv.currency)}
              />
              {csv.preview.problem !== null && (
                <FieldError>
                  {t("importFile.missingColumn", {
                    column: csv.preview.problem.column,
                  })}
                </FieldError>
              )}
            </Stack>
          )}
        </Stack>
      </PageBody>
    </Page>
  );
}
