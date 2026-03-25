import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { FeasibilityEngineV0Service } from "./modules/finance/feasibility-engine-v0.service";
import { FundingProgramsController } from "./modules/funding-programs/funding-programs.controller";
import { FundingProgramsService } from "./modules/funding-programs/funding-programs.service";
import { ParcelsController } from "./modules/parcels/parcels.controller";
import { ParcelsService } from "./modules/parcels/parcels.service";
import { PlanningParametersController } from "./modules/planning-parameters/planning-parameters.controller";
import { PlanningParametersService } from "./modules/planning-parameters/planning-parameters.service";
import { ScenarioRunsController } from "./modules/scenario-runs/scenario-runs.controller";
import { ScenarioRunsProcessor } from "./modules/scenario-runs/scenario-runs.processor";
import { ScenarioRunsService } from "./modules/scenario-runs/scenario-runs.service";
import { ScenarioInputBuilderService } from "./modules/scenarios/scenario-input-builder.service";
import { ScenarioReadinessService } from "./modules/scenarios/scenario-readiness.service";
import { ScenariosController } from "./modules/scenarios/scenarios.controller";
import { ScenariosService } from "./modules/scenarios/scenarios.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({ name: "scenario-runs" }),
    PrismaModule,
    RequestContextModule,
  ],
  controllers: [
    ParcelsController,
    PlanningParametersController,
    FundingProgramsController,
    ScenariosController,
    ScenarioRunsController,
  ],
  providers: [
    ParcelsService,
    PlanningParametersService,
    FundingProgramsService,
    ScenariosService,
    ScenarioReadinessService,
    ScenarioInputBuilderService,
    FeasibilityEngineV0Service,
    ScenarioRunsService,
    ScenarioRunsProcessor,
  ],
})
export class AppModule {}
