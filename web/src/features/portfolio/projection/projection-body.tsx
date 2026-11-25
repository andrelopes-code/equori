import { PlanSection } from "@/features/portfolio/projection/plan-section/plan-section";
import { ProjectionBlocks } from "@/features/portfolio/projection/projection-blocks";
import { ProjectionCurrency } from "@/features/portfolio/projection/states/projection-currency";
import { ProjectionEmpty } from "@/features/portfolio/projection/states/projection-empty";
import { ProjectionFailed } from "@/features/portfolio/projection/states/projection-failed";
import { ProjectionNobirth } from "@/features/portfolio/projection/states/projection-nobirth";
import { ProjectionPending } from "@/features/portfolio/projection/states/projection-pending";
import type { Projection } from "@/features/portfolio/projection/use-projection";

interface ProjectionBodyProps {
  projection: Projection;
}

// PX3, PX11, PX12: the state the tab is in; the blocks follow only a valid draft.
export function ProjectionBody({ projection: p }: ProjectionBodyProps) {
  if (p.phase === "pending") return <ProjectionPending />;

  if (p.phase === "failed")
    return (
      <ProjectionFailed
        error={p.error ?? new Error("projection")}
        onRetry={p.retry}
      />
    );

  if (p.phase === "currency")
    return (
      <ProjectionCurrency
        plan={p.planCurrency ?? ""}
        base={p.base ?? ""}
        deleting={p.remove.pending}
        onDelete={p.remove.run}
      />
    );

  if (p.phase === "empty") return <ProjectionEmpty onBuild={p.build} />;

  return (
    <>
      <PlanSection
        fields={p.fields}
        onChange={p.change}
        age={p.age}
        annualReal={p.annualReal}
        currency={p.currency ?? ""}
        tooEarly={p.tooEarly}
        canSave={p.draft !== null}
        saving={p.save.pending}
        error={p.save.error}
        onSave={p.save.run}
      />

      {p.phase === "nobirth" && <ProjectionNobirth />}

      {p.draft !== null && p.birthDate !== undefined && !p.tooEarly && (
        <ProjectionBlocks
          draft={p.draft}
          history={p.history}
          birthDate={p.birthDate}
          baseline={p.baseline}
          annualReal={p.annualReal}
          onChanges={p.setChanges}
        />
      )}
    </>
  );
}
