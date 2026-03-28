import { Controller, Get, Param, Post, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { ScenarioRunDto } from "../../../../../packages/contracts/dist/feasibility";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { ScenarioRunsService } from "./scenario-runs.service";

@ApiTags("scenario-runs")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller()
export class ScenarioRunsController {
  constructor(private readonly scenarioRunsService: ScenarioRunsService) {}

  @Post("scenarios/:scenarioId/feasibility-runs")
  @Version("1")
  createRun(@Param("scenarioId") scenarioId: string): Promise<ScenarioRunDto> {
    return this.scenarioRunsService.enqueue(scenarioId);
  }

  @Get("scenario-runs/:runId")
  @Version("1")
  getRun(@Param("runId") runId: string): Promise<ScenarioRunDto> {
    return this.scenarioRunsService.getById(runId);
  }
}
