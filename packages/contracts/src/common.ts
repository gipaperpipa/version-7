import type { Geometry, MultiPolygon, Point, Polygon } from "geojson";

export type Id = string;
export type IsoDateTime = string;
export type DecimalString = string;

export type GeometryDto = Geometry;
export type PolygonDto = Polygon;
export type MultiPolygonDto = MultiPolygon;
export type PolygonalGeometryDto = Polygon | MultiPolygon;
export type PointDto = Point;

export interface PagedResponseDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RunWarningDto {
  code: string;
  message: string;
  field?: string;
}

export interface ConfidenceOutputDto {
  inputConfidencePct: number | null;
  outputConfidencePct: number | null;
  reasons: string[];
}

export interface RunDiagnosticsDto {
  warnings: RunWarningDto[];
  missingDataFlags: string[];
  confidence: ConfidenceOutputDto;
}
