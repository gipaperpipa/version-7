import { PrismaClient, FundingCategory, FundingProviderType, SourceType, StrategyType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const program = await prisma.fundingProgram.upsert({
    where: { code: "REP_FREE_FINANCING_RESI_DEBT" },
    update: {},
    create: {
      code: "REP_FREE_FINANCING_RESI_DEBT",
      name: "Representative Free Financing Residential Development Loan",
      providerName: "Representative Commercial Bank",
      providerType: FundingProviderType.COMMERCIAL_BANK,
      category: FundingCategory.FREE_LOAN,
      isGlobal: true,
      isActive: true,
      description: "Synthetic free-financing baseline for Sprint 1 heuristic runs.",
      sourceType: SourceType.SYSTEM_DERIVED,
      metadata: { representative: true },
    },
  });

  await prisma.fundingProgramVariant.upsert({
    where: { code: "REP_FREE_FINANCING_RESI_DEBT_V1" },
    update: {},
    create: {
      fundingProgramId: program.id,
      code: "REP_FREE_FINANCING_RESI_DEBT_V1",
      name: "Free Financing Senior Debt v1",
      termMonths: 240,
      interestRatePct: "4.7500",
      maxLoanPct: "0.7000",
      loanCapPct: "0.7000",
      eligibleStrategyTypes: [
        StrategyType.FREE_MARKET_RENTAL,
        StrategyType.STUDENT_HOUSING,
        StrategyType.BUILD_TO_SELL,
        StrategyType.MIXED_STRATEGY,
      ],
      allowsKfwCombination: true,
    },
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
