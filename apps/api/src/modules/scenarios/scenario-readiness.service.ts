import { Injectable, Scope } from "@nestjs/common";
import type { ScenarioReadinessDto } from "../../generated-contracts/readiness";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { ScenarioForValidation } from "./scenario.types";
import { ScenarioValidationService } from "./scenario-validation.service";

@Injectable({ scope: Scope.REQUEST })
export class ScenarioReadinessService {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly scenarioValidationService: ScenarioValidationService,
  ) {}

  async evaluateByScenarioId(scenarioId: string): Promise<ScenarioReadinessDto> {
    const scenario = await this.loadScenarioForValidation(scenarioId);
    return this.scenarioValidationService.evaluateLoadedScenario(scenario).readiness;
  }

  async loadScenarioForValidation(scenarioId: string): Promise<ScenarioForValidation> {
    return this.scenarioValidationService.loadScenarioForOrganization(
      scenarioId,
      this.requestContext.organizationId,
    );
  }

  evaluateLoadedScenario(scenario: ScenarioForValidation) {
    return this.scenarioValidationService.evaluateLoadedScenario(scenario);
  }
}
