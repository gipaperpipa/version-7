import { Controller, Get, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import {
  FundingCategory,
  FundingProviderType,
  StrategyType,
  type ListFundingProgramsResponseDto,
} from "@repo/contracts";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { FundingProgramsService } from "./funding-programs.service";

@ApiTags("funding-programs")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller("funding-programs")
export class FundingProgramsController {
  constructor(private readonly fundingProgramsService: FundingProgramsService) {}

  @Get()
  @Version("1")
  list(
    @Query("stateCode") stateCode?: string,
    @Query("providerType") providerType?: FundingProviderType,
    @Query("category") category?: FundingCategory,
    @Query("strategyType") strategyType?: StrategyType,
  ): Promise<ListFundingProgramsResponseDto> {
    return this.fundingProgramsService.list({ stateCode, providerType, category, strategyType });
  }
}
