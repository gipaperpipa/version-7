import { Body, Controller, Get, Param, Patch, Post, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  ListPlanningParametersResponseDto,
  PlanningParameterDto,
  UpsertPlanningParameterRequestDto,
} from "../../../../../packages/contracts/dist/planning";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { PlanningParametersService } from "./planning-parameters.service";

@ApiTags("planning-parameters")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller("parcels/:parcelId/planning-parameters")
export class PlanningParametersController {
  constructor(private readonly planningParametersService: PlanningParametersService) {}

  @Get()
  @Version("1")
  list(@Param("parcelId") parcelId: string): Promise<ListPlanningParametersResponseDto> {
    return this.planningParametersService.listForParcel(parcelId);
  }

  @Post()
  @Version("1")
  create(
    @Param("parcelId") parcelId: string,
    @Body() dto: UpsertPlanningParameterRequestDto,
  ): Promise<PlanningParameterDto> {
    return this.planningParametersService.createForParcel(parcelId, dto);
  }

  @Patch(":planningParameterId")
  @Version("1")
  update(
    @Param("parcelId") parcelId: string,
    @Param("planningParameterId") planningParameterId: string,
    @Body() dto: UpsertPlanningParameterRequestDto,
  ): Promise<PlanningParameterDto> {
    return this.planningParametersService.updateForParcel(parcelId, planningParameterId, dto);
  }
}
