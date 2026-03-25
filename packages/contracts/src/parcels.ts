import type {
  DecimalString,
  Id,
  IsoDateTime,
  MultiPolygonDto,
  PagedResponseDto,
  PointDto,
  PolygonalGeometryDto,
} from "./common";
import type { SourceType } from "./enums";

export interface ParcelDto {
  id: Id;
  organizationId: Id;
  name: string | null;
  cadastralId: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  stateCode: string | null;
  countryCode: string | null;
  municipalityName: string | null;
  districtName: string | null;
  landAreaSqm: DecimalString | null;
  sourceType: SourceType;
  sourceReference: string | null;
  confidenceScore: number | null;
  geom: MultiPolygonDto | null;
  centroid: PointDto | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateParcelRequestDto {
  name?: string;
  cadastralId?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  stateCode?: string;
  countryCode?: string;
  municipalityName?: string;
  districtName?: string;
  landAreaSqm?: DecimalString;
  sourceType: SourceType;
  sourceReference?: string;
  confidenceScore?: number;
  geom?: PolygonalGeometryDto;
}

export interface UpdateParcelRequestDto extends Partial<CreateParcelRequestDto> {
  landAreaSqm?: DecimalString | null;
  sourceReference?: string | null;
  confidenceScore?: number | null;
  geom?: PolygonalGeometryDto | null;
}

export type ListParcelsResponseDto = PagedResponseDto<ParcelDto>;
