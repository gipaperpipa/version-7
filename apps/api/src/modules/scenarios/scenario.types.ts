import { Prisma } from "@prisma/client";

export const scenarioWithFundingArgs = Prisma.validator<Prisma.ScenarioDefaultArgs>()({
  include: {
    fundingVariants: {
      orderBy: { stackOrder: "asc" },
    },
  },
});

export type ScenarioWithFunding = Prisma.ScenarioGetPayload<typeof scenarioWithFundingArgs>;

export const scenarioForValidationArgs = Prisma.validator<Prisma.ScenarioDefaultArgs>()({
  include: {
    project: {
      include: {
        anchorParcel: true,
      },
    },
    parcel: {
      include: {
        planningParameters: true,
      },
    },
    fundingVariants: {
      include: {
        fundingProgramVariant: true,
      },
      orderBy: { stackOrder: "asc" },
    },
  },
});

export type ScenarioForValidation = Prisma.ScenarioGetPayload<typeof scenarioForValidationArgs>;
