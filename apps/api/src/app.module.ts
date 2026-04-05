import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./common/prisma/prisma.module";
import { getRedisConnectionConfig } from "./common/redis/redis-config";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { FeasibilityEngineV0Service } from "./modules/finance/feasibility-engine-v0.service";
import { FundingProgramsController } from "./modules/funding-programs/funding-programs.controller";
import { FundingProgramsService } from "./modules/funding-programs/funding-programs.service";
import { ParcelsController } from "./modules/parcels/parcels.controller";
import { ParcelsService } from "./modules/parcels/parcels.service";
import { SourceParcelProviderRegistryService } from "./modules/parcels/source-parcel-provider-registry.service";
import { PlanningParametersController } from "./modules/planning-parameters/planning-parameters.controller";
import { PlanningParametersService } from "./modules/planning-parameters/planning-parameters.service";
import { ScenarioRunsController } from "./modules/scenario-runs/scenario-runs.controller";
import { ScenarioRunsProcessor } from "./modules/scenario-runs/scenario-runs.processor";
import { ScenarioRunsService } from "./modules/scenario-runs/scenario-runs.service";
import { ScenarioInputBuilderService } from "./modules/scenarios/scenario-input-builder.service";
import { ScenarioReadinessService } from "./modules/scenarios/scenario-readiness.service";
import { ScenarioValidationService } from "./modules/scenarios/scenario-validation.service";
import { ScenariosController } from "./modules/scenarios/scenarios.controller";
import { ScenariosService } from "./modules/scenarios/scenarios.service";

const bullDisabled = (process.env.DISABLE_BULL ?? "").toLowerCase() === "true";

const bullImports = bullDisabled
  ? []
  : [
      BullModule.forRoot({
        connection: getRedisConnectionConfig(),
      }),
      BullModule.registerQueue({ name: "scenario-runs" }),
    ];

const bullControllers = bullDisabled ? [] : [ScenarioRunsController];

const bullProviders = bullDisabled ? [] : [ScenarioRunsService, ScenarioRunsProcessor];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...bullImports,
    PrismaModule,
    RequestContextModule,
  ],
  controllers: [
    HealthController,
    ParcelsController,
    PlanningParametersController,
    FundingProgramsController,
    ScenariosController,
    ...bullControllers,
  ],
  providers: [
    ParcelsService,
    PlanningParametersService,
    FundingProgramsService,
    ScenariosService,
    ScenarioValidationService,
    ScenarioReadinessService,
    ScenarioInputBuilderService,
    FeasibilityEngineV0Service,
    SourceParcelProviderRegistryService,
    ...bullProviders,
  ],
})
export class AppModule {}
