const {
  LOCAL_DEV_DEMO_ORGANIZATION_NAME,
  LOCAL_DEV_DEMO_ORGANIZATION_SLUG,
  LOCAL_DEV_DEMO_USER_EMAIL,
  LOCAL_DEV_DEMO_USER_ID,
} = require("@repo/contracts");
const {
  AcquisitionType,
  FinancingSourceType,
  FundingCategory,
  FundingProviderType,
  OptimizationTarget,
  PlanningParameterKey,
  PlanningParameterType,
  PrismaClient,
  SourceType,
  StrategyType,
  UserRole,
} = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertMembership(demoUserId, demoOrganizationId) {
  const existingMembership = await prisma.organizationMembership.findFirst({
    where: {
      userId: demoUserId,
      organizationId: demoOrganizationId,
    },
  });

  if (existingMembership) {
    return prisma.organizationMembership.update({
      where: { id: existingMembership.id },
      data: {
        role: UserRole.ORG_OWNER,
        isDefault: true,
      },
    });
  }

  return prisma.organizationMembership.create({
    data: {
      userId: demoUserId,
      organizationId: demoOrganizationId,
      role: UserRole.ORG_OWNER,
      isDefault: true,
    },
  });
}

async function upsertFundingProgram(config) {
  return prisma.fundingProgram.upsert({
    where: { code: config.code },
    update: {
      name: config.name,
      providerName: config.providerName,
      providerType: config.providerType,
      category: config.category,
      isGlobal: true,
      isActive: true,
      description: config.description,
      sourceType: config.sourceType,
      metadata: config.metadata,
    },
    create: {
      code: config.code,
      name: config.name,
      providerName: config.providerName,
      providerType: config.providerType,
      category: config.category,
      isGlobal: true,
      isActive: true,
      description: config.description,
      sourceType: config.sourceType,
      metadata: config.metadata,
    },
  });
}

async function upsertFundingVariant(programId, config) {
  return prisma.fundingProgramVariant.upsert({
    where: { code: config.code },
    update: {
      fundingProgramId: programId,
      name: config.name,
      termMonths: config.termMonths,
      interestRatePct: config.interestRatePct,
      maxLoanPct: config.maxLoanPct,
      maxLoanPerSqm: config.maxLoanPerSqm,
      rentCapEurSqm: config.rentCapEurSqm,
      loanCapPct: config.loanCapPct,
      subsidyEligibleSharePct: config.subsidyEligibleSharePct,
      eligibleStrategyTypes: config.eligibleStrategyTypes,
      allowsKfwCombination: config.allowsKfwCombination,
      metadata: config.metadata,
    },
    create: {
      fundingProgramId: programId,
      code: config.code,
      name: config.name,
      termMonths: config.termMonths,
      interestRatePct: config.interestRatePct,
      maxLoanPct: config.maxLoanPct,
      maxLoanPerSqm: config.maxLoanPerSqm,
      rentCapEurSqm: config.rentCapEurSqm,
      loanCapPct: config.loanCapPct,
      subsidyEligibleSharePct: config.subsidyEligibleSharePct,
      eligibleStrategyTypes: config.eligibleStrategyTypes,
      allowsKfwCombination: config.allowsKfwCombination,
      metadata: config.metadata,
    },
  });
}

async function upsertPlanningParameter(organizationId, parcelId, config) {
  const existing = await prisma.planningParameter.findFirst({
    where: {
      organizationId,
      parcelId,
      keySlug: config.keySlug,
    },
  });

  const data = {
    organizationId,
    parcelId,
    parameterKey: config.parameterKey,
    keyNamespace: "core",
    keySlug: config.keySlug,
    parameterType: config.parameterType,
    label: config.label,
    unit: config.unit ?? null,
    valueNumber: config.valueNumber ?? null,
    valueBoolean: config.valueBoolean ?? null,
    valueJson: config.valueJson ?? null,
    geom: config.geom ?? null,
    sourceType: config.sourceType,
    sourceReference: config.sourceReference ?? null,
    confidenceScore: config.confidenceScore ?? null,
  };

  if (existing) {
    return prisma.planningParameter.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.planningParameter.create({ data });
}

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { id: LOCAL_DEV_DEMO_USER_ID },
    update: { email: LOCAL_DEV_DEMO_USER_EMAIL },
    create: {
      id: LOCAL_DEV_DEMO_USER_ID,
      email: LOCAL_DEV_DEMO_USER_EMAIL,
    },
  });

  const demoOrganization = await prisma.organization.upsert({
    where: { slug: LOCAL_DEV_DEMO_ORGANIZATION_SLUG },
    update: { name: LOCAL_DEV_DEMO_ORGANIZATION_NAME },
    create: {
      slug: LOCAL_DEV_DEMO_ORGANIZATION_SLUG,
      name: LOCAL_DEV_DEMO_ORGANIZATION_NAME,
    },
  });

  await upsertMembership(demoUser.id, demoOrganization.id);

  const freeFinancingProgram = await upsertFundingProgram({
    code: "REP_FREE_FINANCING_RESI_DEBT",
    name: "Representative Free Financing Residential Development Loan",
    providerName: "Representative Commercial Bank",
    providerType: FundingProviderType.COMMERCIAL_BANK,
    category: FundingCategory.FREE_LOAN,
    description: "Synthetic free-financing baseline for Sprint 1 heuristic runs.",
    sourceType: SourceType.SYSTEM_DERIVED,
    metadata: { representative: true },
  });

  const stateSubsidyProgram = await upsertFundingProgram({
    code: "REP_STATE_SUBSIDY_RENTAL",
    name: "Representative State Subsidy Rental Loan",
    providerName: "Representative State Subsidy Bank",
    providerType: FundingProviderType.STATE_SUBSIDY_BANK,
    category: FundingCategory.STATE_SUBSIDY_LOAN,
    description: "Representative state subsidy baseline for demo feasibility cases.",
    sourceType: SourceType.SYSTEM_DERIVED,
    metadata: { representative: true },
  });

  const kfwProgram = await upsertFundingProgram({
    code: "REP_KFW_RESI_DEBT",
    name: "Representative KfW Residential Loan",
    providerName: "KfW",
    providerType: FundingProviderType.KFW,
    category: FundingCategory.KFW_LOAN,
    description: "Representative KfW baseline for demo feasibility cases.",
    sourceType: SourceType.SYSTEM_DERIVED,
    metadata: { representative: true },
  });

  const freeFinancingVariant = await upsertFundingVariant(freeFinancingProgram.id, {
    code: "REP_FREE_FINANCING_RESI_DEBT_V1",
    name: "Free Financing Senior Debt v1",
    termMonths: 240,
    interestRatePct: "4.7500",
    maxLoanPct: "0.7000",
    maxLoanPerSqm: null,
    rentCapEurSqm: null,
    loanCapPct: "0.7000",
    subsidyEligibleSharePct: null,
    eligibleStrategyTypes: [
      StrategyType.FREE_MARKET_RENTAL,
      StrategyType.STUDENT_HOUSING,
      StrategyType.BUILD_TO_SELL,
      StrategyType.MIXED_STRATEGY,
    ],
    allowsKfwCombination: true,
    metadata: { representative: true },
  });

  const stateSubsidyVariant = await upsertFundingVariant(stateSubsidyProgram.id, {
    code: "REP_STATE_SUBSIDY_RENTAL_V1",
    name: "State Subsidy Rental Loan v1",
    termMonths: 360,
    interestRatePct: "1.1500",
    maxLoanPct: "0.4500",
    maxLoanPerSqm: "1800.0000",
    rentCapEurSqm: "7.5000",
    loanCapPct: "0.4500",
    subsidyEligibleSharePct: "1.0000",
    eligibleStrategyTypes: [
      StrategyType.SUBSIDIZED_RENTAL,
      StrategyType.MIXED_STRATEGY,
    ],
    allowsKfwCombination: true,
    metadata: { representative: true },
  });

  const kfwVariant = await upsertFundingVariant(kfwProgram.id, {
    code: "REP_KFW_RESI_DEBT_V1",
    name: "KfW Residential Loan v1",
    termMonths: 300,
    interestRatePct: "2.3500",
    maxLoanPct: "0.2500",
    maxLoanPerSqm: "1200.0000",
    rentCapEurSqm: null,
    loanCapPct: "0.2500",
    subsidyEligibleSharePct: null,
    eligibleStrategyTypes: [
      StrategyType.FREE_MARKET_RENTAL,
      StrategyType.SUBSIDIZED_RENTAL,
      StrategyType.STUDENT_HOUSING,
      StrategyType.MIXED_STRATEGY,
    ],
    allowsKfwCombination: true,
    metadata: { representative: true },
  });

  const existingParcel = await prisma.parcel.findFirst({
    where: {
      organizationId: demoOrganization.id,
      sourceReference: "seed:demo-parcel",
    },
  });

  const demoParcel = existingParcel
    ? await prisma.parcel.update({
        where: { id: existingParcel.id },
        data: {
          name: "Demo Transit-Oriented Site",
          cadastralId: "DEMO-CAD-001",
          addressLine1: "Alexanderstrasse 10",
          city: "Berlin",
          postalCode: "10178",
          stateCode: "BE",
          countryCode: "DE",
          municipalityName: "Berlin",
          districtName: "Mitte",
          landAreaSqm: "4200.0000",
          sourceType: SourceType.IMPORT,
          sourceReference: "seed:demo-parcel",
          confidenceScore: 89,
        },
      })
    : await prisma.parcel.create({
        data: {
          organizationId: demoOrganization.id,
          name: "Demo Transit-Oriented Site",
          cadastralId: "DEMO-CAD-001",
          addressLine1: "Alexanderstrasse 10",
          city: "Berlin",
          postalCode: "10178",
          stateCode: "BE",
          countryCode: "DE",
          municipalityName: "Berlin",
          districtName: "Mitte",
          landAreaSqm: "4200.0000",
          sourceType: SourceType.IMPORT,
          sourceReference: "seed:demo-parcel",
          confidenceScore: 89,
        },
      });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.GRZ,
    keySlug: "GRZ",
    parameterType: PlanningParameterType.NUMBER,
    label: "Site Coverage Ratio (GRZ)",
    unit: "ratio",
    valueNumber: "0.3800",
    sourceType: SourceType.IMPORT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 86,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.GFZ,
    keySlug: "GFZ",
    parameterType: PlanningParameterType.NUMBER,
    label: "Floor Area Ratio (GFZ)",
    unit: "ratio",
    valueNumber: "1.6500",
    sourceType: SourceType.IMPORT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 86,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.MAX_HEIGHT_M,
    keySlug: "MAX_HEIGHT_M",
    parameterType: PlanningParameterType.NUMBER,
    label: "Max Building Height",
    unit: "m",
    valueNumber: "22.0000",
    sourceType: SourceType.IMPORT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 82,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.MAX_FLOORS,
    keySlug: "MAX_FLOORS",
    parameterType: PlanningParameterType.NUMBER,
    label: "Max Floors",
    unit: "floors",
    valueNumber: "6.0000",
    sourceType: SourceType.IMPORT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 82,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.PARKING_SPACES_PER_UNIT,
    keySlug: "PARKING_SPACES_PER_UNIT",
    parameterType: PlanningParameterType.NUMBER,
    label: "Parking Spaces per Unit",
    unit: "spaces/unit",
    valueNumber: "0.6000",
    sourceType: SourceType.USER_INPUT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 72,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.SUBSIDY_ELIGIBILITY,
    keySlug: "SUBSIDY_ELIGIBILITY",
    parameterType: PlanningParameterType.BOOLEAN,
    label: "Subsidy Eligibility",
    unit: null,
    valueBoolean: true,
    sourceType: SourceType.IMPORT,
    sourceReference: "seed:demo-planning",
    confidenceScore: 80,
  });

  await upsertPlanningParameter(demoOrganization.id, demoParcel.id, {
    parameterKey: PlanningParameterKey.BUILDABLE_WINDOW,
    keySlug: "BUILDABLE_WINDOW",
    parameterType: PlanningParameterType.GEOMETRY,
    label: "Buildable Window Area",
    unit: "sqm",
    valueNumber: "1600.0000",
    geom: {
      type: "Polygon",
      coordinates: [
        [
          [13.4138, 52.5216],
          [13.4146, 52.5216],
          [13.4146, 52.5222],
          [13.4138, 52.5222],
          [13.4138, 52.5216],
        ],
      ],
    },
    sourceType: SourceType.SYSTEM_DERIVED,
    sourceReference: "seed:derived-buildable-window",
    confidenceScore: 84,
  });

  const existingScenario = await prisma.scenario.findFirst({
    where: {
      organizationId: demoOrganization.id,
      name: "Demo Free-Market Rental",
    },
  });

  const demoScenario = existingScenario
    ? await prisma.scenario.update({
        where: { id: existingScenario.id },
        data: {
          createdById: demoUser.id,
          parcelId: demoParcel.id,
          name: "Demo Free-Market Rental",
          description: "Seeded starter scenario for public Feasibility OS testing.",
          strategyType: StrategyType.FREE_MARKET_RENTAL,
          acquisitionType: AcquisitionType.BUY,
          optimizationTarget: OptimizationTarget.MIN_REQUIRED_EQUITY,
          avgUnitSizeSqm: "68.0000",
          targetMarketRentEurSqm: "18.5000",
          hardCostPerBgfSqm: "3100.0000",
          softCostPct: "0.1600",
          parkingCostPerSpace: "28000.0000",
          landCost: "2600000.0000",
          equityTargetPct: "0.2000",
        },
      })
    : await prisma.scenario.create({
        data: {
          organizationId: demoOrganization.id,
          createdById: demoUser.id,
          parcelId: demoParcel.id,
          name: "Demo Free-Market Rental",
          description: "Seeded starter scenario for public Feasibility OS testing.",
          strategyType: StrategyType.FREE_MARKET_RENTAL,
          acquisitionType: AcquisitionType.BUY,
          optimizationTarget: OptimizationTarget.MIN_REQUIRED_EQUITY,
          avgUnitSizeSqm: "68.0000",
          targetMarketRentEurSqm: "18.5000",
          hardCostPerBgfSqm: "3100.0000",
          softCostPct: "0.1600",
          parkingCostPerSpace: "28000.0000",
          landCost: "2600000.0000",
          equityTargetPct: "0.2000",
        },
      });

  await prisma.scenarioFundingVariant.deleteMany({
    where: { scenarioId: demoScenario.id },
  });

  await prisma.scenarioFundingVariant.createMany({
    data: [
      {
        scenarioId: demoScenario.id,
        fundingProgramVariantId: kfwVariant.id,
        label: "KfW",
        financingSourceType: FinancingSourceType.KFW,
        stackOrder: 1,
        isEnabled: true,
      },
      {
        scenarioId: demoScenario.id,
        fundingProgramVariantId: freeFinancingVariant.id,
        label: "Free financing",
        financingSourceType: FinancingSourceType.FREE_FINANCING,
        stackOrder: 2,
        isEnabled: true,
      },
      {
        scenarioId: demoScenario.id,
        fundingProgramVariantId: stateSubsidyVariant.id,
        label: "State subsidy",
        financingSourceType: FinancingSourceType.STATE_SUBSIDY,
        stackOrder: 3,
        isEnabled: false,
      },
    ],
  });

  console.info(`[seed] Demo workspace ready at /${LOCAL_DEV_DEMO_ORGANIZATION_SLUG}`);
  console.info(`[seed] Demo parcel: ${demoParcel.name}`);
  console.info(`[seed] Demo scenario: ${demoScenario.name}`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
