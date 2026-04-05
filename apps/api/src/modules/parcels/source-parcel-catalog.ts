import type { SourceParcelSearchResultDto } from "../../generated-contracts/parcels";
import {
  buildNormalizedSourceSearchResult,
  type NormalizedSourceParcelRecord,
} from "./source-parcel-model";
import type { SourceParcelProvider } from "./source-parcel-provider";

function rectangle(
  west: number,
  south: number,
  east: number,
  north: number,
): NonNullable<SourceParcelSearchResultDto["geom"]> {
  return {
    type: "MultiPolygon",
    coordinates: [[[
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ]]],
  };
}

const DEMO_PROVIDER_KEY = "demo-cadastre";

const SOURCE_PARCELS: NormalizedSourceParcelRecord[] = [
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-frankfurt-bockenheim-001`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-16-204-7",
    sourceAuthority: "DEMO",
    displayName: "Bockenheim urban infill site",
    cadastralId: "60326-016-204/7",
    addressLine1: "Schlossstrasse 18",
    city: "Frankfurt am Main",
    postalCode: "60486",
    stateCode: "HE",
    countryCode: "DE",
    municipalityName: "Frankfurt am Main",
    districtName: "Bockenheim",
    confidenceScore: 92,
    geom: rectangle(8.6396, 50.11876, 8.64062, 50.11936),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "urban mixed-use block",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-frankfurt-gallus-002`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-17-119-14",
    sourceAuthority: "DEMO",
    displayName: "Gallus perimeter block parcel",
    cadastralId: "60327-017-119/14",
    addressLine1: "Mainzer Landstrasse 208",
    city: "Frankfurt am Main",
    postalCode: "60327",
    stateCode: "HE",
    countryCode: "DE",
    municipalityName: "Frankfurt am Main",
    districtName: "Gallus",
    confidenceScore: 89,
    geom: rectangle(8.65024, 50.10585, 8.65115, 50.10632),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "corridor parcel",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-frankfurt-ostend-003`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-22-881-3",
    sourceAuthority: "DEMO",
    displayName: "Ostend corner redevelopment parcel",
    cadastralId: "60314-022-881/3",
    addressLine1: "Hanauer Landstrasse 79",
    city: "Frankfurt am Main",
    postalCode: "60314",
    stateCode: "HE",
    countryCode: "DE",
    municipalityName: "Frankfurt am Main",
    districtName: "Ostend",
    confidenceScore: 88,
    geom: rectangle(8.70818, 50.11341, 8.70911, 50.11395),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "corner parcel",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-berlin-neukoelln-004`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "BER-08-442-12",
    sourceAuthority: "DEMO",
    displayName: "Neukoelln courtyard assembly parcel",
    cadastralId: "12043-008-442/12",
    addressLine1: "Karl-Marx-Strasse 131",
    city: "Berlin",
    postalCode: "12043",
    stateCode: "BE",
    countryCode: "DE",
    municipalityName: "Berlin",
    districtName: "Neukoelln",
    confidenceScore: 90,
    geom: rectangle(13.4338, 52.47622, 13.4347, 52.47674),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "inner courtyard site",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-berlin-moabit-005`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "BER-02-113-41",
    sourceAuthority: "DEMO",
    displayName: "Moabit canal-edge parcel",
    cadastralId: "10557-002-113/41",
    addressLine1: "Alt-Moabit 111",
    city: "Berlin",
    postalCode: "10557",
    stateCode: "BE",
    countryCode: "DE",
    municipalityName: "Berlin",
    districtName: "Moabit",
    confidenceScore: 87,
    geom: rectangle(13.34625, 52.52355, 13.34727, 52.52405),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "waterfront block edge",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-hamburg-altona-006`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "HAM-03-781-22",
    sourceAuthority: "DEMO",
    displayName: "Altona station hinterland parcel",
    cadastralId: "22767-003-781/22",
    addressLine1: "Harkortstrasse 67",
    city: "Hamburg",
    postalCode: "22765",
    stateCode: "HH",
    countryCode: "DE",
    municipalityName: "Hamburg",
    districtName: "Altona",
    confidenceScore: 84,
    geom: rectangle(9.93428, 53.55248, 9.93525, 53.55296),
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        zoningHint: "station-area parcel",
        intakeMode: "source-search",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
  buildNormalizedSourceSearchResult({
    id: `${DEMO_PROVIDER_KEY}:cadastre-cologne-ehrenfeld-007`,
    providerName: "Demo Cadastre Index",
    providerParcelId: "CGN-07-210-9",
    sourceAuthority: "DEMO",
    displayName: "Ehrenfeld workshop parcel",
    cadastralId: "50825-007-210/9",
    addressLine1: "Venloer Strasse 364",
    city: "Koeln",
    postalCode: "50825",
    stateCode: "NW",
    countryCode: "DE",
    municipalityName: "Koeln",
    districtName: "Ehrenfeld",
    confidenceScore: 82,
    geom: null,
    landAreaSqm: "5180",
    rawMetadata: {
        sourceSystem: "demo-cadastre",
        intakeMode: "source-search",
        geometryStatus: "pending-digitization",
        providerKind: "DEMO",
        sourceAuthority: "DEMO",
        geometryAuthority: "DEMO_SYNTHETIC",
      },
    }),
];

function includesToken(value: string | null | undefined, token: string) {
  return typeof value === "string" && value.toLowerCase().includes(token);
}

export class SourceParcelDemoProvider implements SourceParcelProvider {
  readonly key = DEMO_PROVIDER_KEY;
  readonly kind = "DEMO" as const;

  canHandleSourceParcelId(sourceParcelId: string) {
    return sourceParcelId.startsWith(`${DEMO_PROVIDER_KEY}:`);
  }

  async search(query?: string | null, municipality?: string | null, limit = 12) {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    const normalizedMunicipality = municipality?.trim().toLowerCase() ?? "";

    return SOURCE_PARCELS.filter((parcel) => {
      const municipalityMatch = normalizedMunicipality
        ? includesToken(parcel.municipalityName, normalizedMunicipality) || includesToken(parcel.city, normalizedMunicipality)
        : true;

      if (!municipalityMatch) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        parcel.displayName,
        parcel.providerParcelId,
        parcel.cadastralId,
        parcel.addressLine1,
        parcel.city,
        parcel.municipalityName,
        parcel.districtName,
      ].some((candidate) => includesToken(candidate, normalizedQuery));
    }).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getByIds(sourceParcelIds: string[]) {
    const wanted = new Set(sourceParcelIds);
    return SOURCE_PARCELS.filter((parcel) => wanted.has(parcel.id));
  }
}
