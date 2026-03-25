import type {
  DecimalString,
  GeometryDto,
  Id,
  IsoDateTime,
  PagedResponseDto,
} from "./common";
import type {
  PlanningParameterKey,
  PlanningParameterType,
  SourceType,
} from "./enums";

export interface PlanningParameterDto {
  id: Id;
  organizationId: Id;
  planningDocumentId: Id | null;
  parcelId: Id | null;
  parcelGroupId: Id | null;
  parameterKey: PlanningParameterKey | null;
  customKey: string | null;
  keyNamespace: string;
  keySlug: string;
  parameterType: PlanningParameterType;
  label: string;
  unit: string | null;
  valueText: string | null;
  valueNumber: DecimalString | null;
  valueBoolean: boolean | null;
  valueJson: Record<string, unknown> | null;
  geom: GeometryDto | null;
  sourceType: SourceType;
  sourceReference: string | null;
  confidenceScore: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UpsertPlanningParameterRequestDto {
  planningDocumentId?: Id | null;
  parameterKey?: PlanningParameterKey | null;
  customKey?: string | null;
  keyNamespace?: string | null;
  parameterType: PlanningParameterType;
  label: string;
  unit?: string | null;
  valueText?: string | null;
  valueNumber?: DecimalString | null;
  valueBoolean?: boolean | null;
  valueJson?: Record<string, unknown> | null;
  geom?: GeometryDto | null;
  sourceType: SourceType;
  sourceReference?: string | null;
  confidenceScore?: number | null;
}

export type ListPlanningParametersResponseDto = PagedResponseDto<PlanningParameterDto>;
