import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  CreateScenarioRequestDto,
  ListScenarioAssumptionTemplatesResponseDto,
  ListScenariosResponseDto,
  ScenarioComparisonResponseDto,
  ScenarioDto,
  UpdateScenarioRequestDto,
  UpsertScenarioFundingStackRequestDto,
} from "../../generated-contracts/scenarios";
import type { ScenarioReadinessDto } from "../../generated-contracts/readiness";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { ScenarioReadinessService } from "./scenario-readiness.service";
import { ScenariosService } from "./scenarios.service";

@ApiTags("scenarios")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller("scenarios")
export class ScenariosController {
  constructor(
    private readonly scenariosService: ScenariosService,
    private readonly scenarioReadinessService: ScenarioReadinessService,
  ) {}

  @Get()
  @Version("1")
  list(@Query("page") page = "1", @Query("pageSize") pageSize = "20"): Promise<ListScenariosResponseDto> {
    return this.scenariosService.list({ page: Number(page), pageSize: Number(pageSize) });
  }

  @Get("assumption-templates")
  @Version("1")
  listAssumptionTemplates(): ListScenarioAssumptionTemplatesResponseDto {
    return this.scenariosService.listAssumptionTemplates();
  }

  @Get("compare")
  @Version("1")
  compare(
    @Query("scenarioId") scenarioIds: string | string[],
    @Query("rankingTarget") rankingTarget?: CreateScenarioRequestDto["optimizationTarget"],
  ): Promise<ScenarioComparisonResponseDto> {
    const ids = Array.isArray(scenarioIds) ? scenarioIds : scenarioIds ? [scenarioIds] : [];
    return this.scenariosService.compare({ scenarioIds: ids, rankingTarget });
  }

  @Post()
  @Version("1")
  create(@Body() dto: CreateScenarioRequestDto): Promise<ScenarioDto> {
    return this.scenariosService.create(dto);
  }

  @Get(":scenarioId")
  @Version("1")
  getById(@Param("scenarioId") scenarioId: string): Promise<ScenarioDto> {
    return this.scenariosService.getById(scenarioId);
  }

  @Patch(":scenarioId")
  @Version("1")
  update(@Param("scenarioId") scenarioId: string, @Body() dto: UpdateScenarioRequestDto): Promise<ScenarioDto> {
    return this.scenariosService.update(scenarioId, dto);
  }

  @Put(":scenarioId/funding-stack")
  @Version("1")
  upsertFundingStack(
    @Param("scenarioId") scenarioId: string,
    @Body() dto: UpsertScenarioFundingStackRequestDto,
  ): Promise<ScenarioDto> {
    return this.scenariosService.upsertFundingStack(scenarioId, dto);
  }

  @Get(":scenarioId/readiness")
  @Version("1")
  getReadiness(@Param("scenarioId") scenarioId: string): Promise<ScenarioReadinessDto> {
    return this.scenarioReadinessService.evaluateByScenarioId(scenarioId);
  }
}
