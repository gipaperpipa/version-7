import { Prisma } from "@prisma/client";

export const scenarioRunWithResultArgs = Prisma.validator<Prisma.ScenarioRunDefaultArgs>()({
  include: {
    financialResult: true,
  },
});

export type ScenarioRunWithResult = Prisma.ScenarioRunGetPayload<typeof scenarioRunWithResultArgs>;
export type ScenarioRunFinancialResult = NonNullable<ScenarioRunWithResult["financialResult"]>;
