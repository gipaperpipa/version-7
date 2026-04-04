import type { MultiPolygonDto, PointDto } from "../../generated-contracts/common";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function ringSignedAreaSqm(
  ring: MultiPolygonDto["coordinates"][number][number],
  referenceLatitudeRad: number,
) {
  if (!ring.length) return 0;

  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    const projectedX1 = EARTH_RADIUS_METERS * toRadians(x1) * Math.cos(referenceLatitudeRad);
    const projectedY1 = EARTH_RADIUS_METERS * toRadians(y1);
    const projectedX2 = EARTH_RADIUS_METERS * toRadians(x2) * Math.cos(referenceLatitudeRad);
    const projectedY2 = EARTH_RADIUS_METERS * toRadians(y2);
    area += projectedX1 * projectedY2 - projectedX2 * projectedY1;
  }

  return area / 2;
}

export function calculateMultiPolygonAreaSqm(geom: MultiPolygonDto | null | undefined) {
  if (!geom?.coordinates.length) return null;

  const latitudes = geom.coordinates
    .flatMap((polygon) => polygon.flatMap((ring) => ring.map((coordinate) => coordinate[1])));

  if (!latitudes.length) return null;

  const referenceLatitudeRad = toRadians(
    latitudes.reduce((sum, latitude) => sum + latitude, 0) / latitudes.length,
  );

  const area = geom.coordinates.reduce((polygonAccumulator, polygon) => {
    const shellArea = Math.abs(ringSignedAreaSqm(polygon[0] ?? [], referenceLatitudeRad));
    const holeArea = polygon.slice(1).reduce((holeAccumulator, ring) => {
      return holeAccumulator + Math.abs(ringSignedAreaSqm(ring, referenceLatitudeRad));
    }, 0);

    return polygonAccumulator + Math.max(0, shellArea - holeArea);
  }, 0);

  return Number.isFinite(area) ? Math.round(area * 100) / 100 : null;
}

export function calculateMultiPolygonCentroid(geom: MultiPolygonDto | null | undefined): PointDto | null {
  if (!geom?.coordinates.length) return null;

  const points = geom.coordinates.flatMap((polygon) => polygon.flatMap((ring) => ring));
  if (!points.length) return null;

  const [lon, lat] = points.reduce(
    (accumulator, [pointLon, pointLat]) => [accumulator[0] + pointLon, accumulator[1] + pointLat],
    [0, 0],
  );

  return {
    type: "Point",
    coordinates: [lon / points.length, lat / points.length],
  };
}

export function mergeMultiPolygons(geometries: Array<MultiPolygonDto | null | undefined>) {
  const coordinates = geometries.flatMap((geometry) => geometry?.coordinates ?? []);
  if (!coordinates.length) return null;

  return {
    type: "MultiPolygon",
    coordinates,
  } satisfies MultiPolygonDto;
}
