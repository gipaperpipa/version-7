import type { DecimalString, Id, IsoDateTime, PagedResponseDto } from "./common";
import type { ParcelConfidenceBand } from "./parcels";
import type { ProjectStatus, SourceAuthorityLevel } from "./enums";

export interface ProjectAnchorParcelDto {
  id: Id;
  parcelGroupId: Id | null;
  isGroupSite: boolean;
  name: string | null;
  cadastralId: string | null;
  municipalityName: string | null;
  city: string | null;
  landAreaSqm: DecimalString | null;
  confidenceScore: number | null;
  confidenceBand: ParcelConfidenceBand;
  sourceAuthority: SourceAuthorityLevel | null;
}

export interface ProjectDto {
  id: Id;
  organizationId: Id;
  anchorParcelId: Id;
  anchorParcelGroupId: Id | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  anchorParcel: ProjectAnchorParcelDto;
  scenarioCount: number;
  activeScenarioCount: number;
  latestScenarioRunAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateProjectRequestDto {
  parcelId: Id;
  name?: string | null;
  description?: string | null;
  status?: ProjectStatus;
}

export interface UpdateProjectRequestDto {
  name?: string | null;
  description?: string | null;
  status?: ProjectStatus;
}

export type ListProjectsResponseDto = PagedResponseDto<ProjectDto>;
