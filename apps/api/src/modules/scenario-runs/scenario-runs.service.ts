import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, NotFoundException, Scope, UnprocessableEntityException } from "@nestjs/common";
import { Queue } from "bullmq";
import { ScenarioRunStatus } from "@prisma/client";
import type { ScenarioRunDto } from "../../generated-contracts/feasibility";
import { toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ScenarioInputBuilderService } from "../scenarios/scenario-input-builder.service";
import { ScenarioReadinessService } from "../scenarios/scenario-readiness.service";
import { mapScenarioRunDto } from "./scenario-run.mapper";
import { scenarioRunWithResultArgs, type ScenarioRunWithResult } from "./scenario-run.types";

@Injectable({ scope: Scope.REQUEST })
export class ScenarioRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly scenarioReadinessService: ScenarioReadinessService,
    private readonly scenarioInputBuilderService: ScenarioInputBuilderService,
    @InjectQueue("scenario-runs") private readonly scenarioRunsQueue: Queue,
  ) {}

  async enqueue(scenarioId: string): Promise<ScenarioRunDto> {
    const scenario = await this.scenarioReadinessService.loadScenarioForValidation(scenarioId);
    const readiness = this.scenarioReadinessService.evaluateLoadedScenario(scenario);

    if (!readiness.readiness.canRun) {
      throw new UnprocessableEntityException(readiness.readiness);
    }

    const run = await this.prisma.scenarioRun.create({
      data: {
        organizationId: this.requestContext.organizationId,
        scenarioId: scenario.id,
        triggeredById: this.requestContext.userId,
        status: ScenarioRunStatus.QUEUED,
        readinessStatus: readiness.readiness.status,
        inputSnapshot: toPrismaJson(this.scenarioInputBuilderService.buildSnapshot(scenario)),
        readinessIssuesJson: toPrismaJson(readiness.readiness.issues),
        warningsJson: toPrismaJson(readiness.readiness.issues.filter((item) => item.severity === "WARNING")),
        missingDataFlagsJson: toPrismaJson([]),
        confidenceReasonsJson: toPrismaJson(readiness.confidenceReasons),
        inputConfidencePct: readiness.inputConfidencePct,
      },
    });

    const job = await this.scenarioRunsQueue.add("run-feasibility-v0", { scenarioRunId: run.id });

    await this.prisma.scenarioRun.update({
      where: { id: run.id },
      data: { queueJobId: String(job.id) },
    });

    return this.getById(run.id);
  }

  async getById(runId: string): Promise<ScenarioRunDto> {
    const run = await this.prisma.scenarioRun.findFirst({
      ...scenarioRunWithResultArgs,
      where: {
        id: runId,
        organizationId: this.requestContext.organizationId,
      },
    });

    if (!run) {
      throw new NotFoundException("Scenario run not found");
    }

    return this.mapRun(run);
  }

  private mapRun(run: ScenarioRunWithResult): ScenarioRunDto {
    return mapScenarioRunDto(run);
  }
}
