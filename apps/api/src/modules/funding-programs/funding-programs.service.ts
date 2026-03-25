import { Injectable, Scope } from "@nestjs/common";
import type {
  FundingCategory,
  FundingProviderType,
  ListFundingProgramsResponseDto,
  StrategyType,
} from "@repo/contracts";
import { toApiDecimal } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

@Injectable({ scope: Scope.REQUEST })
export class FundingProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(filters: {
    stateCode?: string;
    providerType?: FundingProviderType;
    category?: FundingCategory;
    strategyType?: StrategyType;
  }): Promise<ListFundingProgramsResponseDto> {
    const items = await this.prisma.fundingProgram.findMany({
      where: {
        isActive: true,
        OR: [
          { isGlobal: true },
          { organizationId: this.requestContext.organizationId },
        ],
        stateCode: filters.stateCode ?? undefined,
        providerType: filters.providerType ?? undefined,
        category: filters.category ?? undefined,
        variants: filters.strategyType
          ? { some: { eligibleStrategyTypes: { has: filters.strategyType } } }
          : undefined,
      },
      include: {
        variants: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ providerType: "asc" }, { name: "asc" }],
    });

    return {
      items: items.map((program) => ({
        id: program.id,
        organizationId: program.organizationId,
        code: program.code,
        name: program.name,
        providerName: program.providerName,
        providerType: program.providerType,
        category: program.category,
        stateCode: program.stateCode,
        isGlobal: program.isGlobal,
        isActive: program.isActive,
        description: program.description,
        variants: program.variants.map((variant) => ({
          id: variant.id,
          fundingProgramId: variant.fundingProgramId,
          code: variant.code,
          name: variant.name,
          termMonths: variant.termMonths,
          interestRatePct: toApiDecimal(variant.interestRatePct),
          maxLoanPct: toApiDecimal(variant.maxLoanPct),
          maxLoanPerSqm: toApiDecimal(variant.maxLoanPerSqm),
          rentCapEurSqm: toApiDecimal(variant.rentCapEurSqm),
          loanCapPct: toApiDecimal(variant.loanCapPct),
          subsidyEligibleSharePct: toApiDecimal(variant.subsidyEligibleSharePct),
          eligibleStrategyTypes: variant.eligibleStrategyTypes,
          allowsKfwCombination: variant.allowsKfwCombination,
        })),
      })),
      total: items.length,
      page: 1,
      pageSize: items.length,
    };
  }
}
