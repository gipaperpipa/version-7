import { BadRequestException } from "@nestjs/common";
import type { GeometryDto, MultiPolygonDto, PolygonDto } from "../../contracts";

export function normalizePolygonGeometryToMultiPolygon(
  geom: GeometryDto | null | undefined,
): MultiPolygonDto | null | undefined {
  if (geom === undefined || geom === null) return geom;

  if (geom.type === "MultiPolygon") {
    return geom;
  }

  if (geom.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [geom.coordinates as PolygonDto["coordinates"]],
    } as MultiPolygonDto;
  }

  throw new BadRequestException(
    "Parcel geometry must be GeoJSON Polygon or MultiPolygon. Polygon input is normalized to MultiPolygon before persistence.",
  );
}
