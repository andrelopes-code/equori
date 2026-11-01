import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { Stepper, StepperList, StepperStep } from "@slotted/react/stepper";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import type { AccountDraft } from "@/features/accounts";
import { StartArriveStep } from "@/features/start/start-arrive-step";
import { StartDetailsStep } from "@/features/start/start-details-step";
import { canContinue, startDrafts } from "@/features/start/start-drafts";
import type { StartRow } from "@/features/start/start-drafts";
import { StartWhereStep } from "@/features/start/start-where-step";
import { useStartRun } from "@/features/start/use-start-run";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface StartScreenProps {
  base: string;
  scale: (code: string) => number;
}

const steps = ["where", "details", "arrive"] as const;

export function StartScreen({ base, scale }: StartScreenProps) {
  const t = useT();
  const today = useToday();
  const navigate = useNavigate();
  const nextKey = useRef(1);
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<StartRow[]>([newRow("0")]);
  const [cash, setCash] = useState(false);
  const [drafts, setDrafts] = useState<AccountDraft[]>([]);
  const start = useStartRun(drafts);

  const names = drafts.map((draft) => draft.name);
  const importAccountId = drafts
    .map((draft, index) => ({ draft, run: start.runs[index] }))
    .find(({ draft }) => draft.kind !== "cash")?.run?.accountId;

  function handleRowChange(next: StartRow) {
    setRows(rows.map((row) => (row.key === next.key ? next : row)));
  }

  function handleRowRemove(key: string) {
    setRows(rows.filter((row) => row.key !== key));
  }

  function handleRowAdd() {
    setRows([...rows, newRow(String(nextKey.current++))]);
  }

  function handleChoicesDone() {
    start.reset();
    setDrafts(
      startDrafts(rows, cash, {
        today,
        currency: base,
        kindLabel: (kind) =>
          kind === "cash" ? t("start.cashName") : t(`kind.${kind}`),
        cashName: t("start.cashName"),
      }),
    );
    setStep(1);
  }

  function handleDraftChange(index: number, next: AccountDraft) {
    setDrafts(drafts.map((draft, i) => (i === index ? next : draft)));
  }

  function handleNotNow() {
    void navigate({ to: "/" });
  }

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("start.title")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("start.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>

      <PageBody>
        <Stack gap={8}>
          <Stepper step={step} navigation="none">
            <StepperList aria-label={t("start.title")}>
              {steps.map((name, index) => (
                <StepperStep
                  key={name}
                  label={t(`start.step.${name}`)}
                  complete={step > index}
                />
              ))}
            </StepperList>
          </Stepper>

          {step === 0 && (
            <StartWhereStep
              rows={rows}
              cash={cash}
              canContinue={canContinue(rows, cash)}
              onRowChange={handleRowChange}
              onRowRemove={handleRowRemove}
              onRowAdd={handleRowAdd}
              onCashChange={setCash}
              onContinue={handleChoicesDone}
              onNotNow={handleNotNow}
            />
          )}

          {step === 1 && (
            <StartDetailsStep
              drafts={drafts}
              runs={start.runs}
              scale={scale}
              running={start.running}
              allCreated={start.allCreated}
              anyCreated={start.anyCreated}
              onDraftChange={handleDraftChange}
              onCreate={() => void start.run()}
              onBack={() => {
                setStep(0);
              }}
              onContinue={() => {
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <StartArriveStep names={names} importAccountId={importAccountId} />
          )}
        </Stack>
      </PageBody>
    </Page>
  );
}

function newRow(key: string): StartRow {
  return { key, institutionId: null, institutionName: "", kinds: [] };
}
