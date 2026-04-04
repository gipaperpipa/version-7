import type { SourceParcelSearchResultDto } from "../../generated-contracts/parcels";
import {
  buildNormalizedSourceSearchResult,
  type NormalizedSourceParcelRecord,
} from "./source-parcel-model";

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

interface SourceParcelProvider {
  key: string;
  search(query?: string | null, municipality?: string | null, limit?: number): NormalizedSourceParcelRecord[];
  getByIds(sourceParcelIds: string[]): NormalizedSourceParcelRecord[];
}

const SOURCE_PARCELS: NormalizedSourceParcelRecord[] = [
  buildNormalizedSourceSearchResult({
    id: "cadastre-frankfurt-bockenheim-001",
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-16-204-7",
    displayName: "Bockenheim urban infill site",
    cadastralId: "60326-016-204/7",
    addressLine1: "Schloßstraße 18",
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
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-frankfurt-gallus-002",
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-17-119-14",
    displayName: "Gallus perimeter block parcel",
    cadastralId: "60327-017-119/14",
    addressLine1: "Mainzer Landstraße 208",
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
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-frankfurt-ostend-003",
    providerName: "Demo Cadastre Index",
    providerParcelId: "FFM-22-881-3",
    displayName: "Ostend corner redevelopment parcel",
    cadastralId: "60314-022-881/3",
    addressLine1: "Hanauer Landstraße 79",
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
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-berlin-neukoelln-004",
    providerName: "Demo Cadastre Index",
    providerParcelId: "BER-08-442-12",
    displayName: "Neukölln courtyard assembly parcel",
    cadastralId: "12043-008-442/12",
    addressLine1: "Karl-Marx-Straße 131",
    city: "Berlin",
    postalCode: "12043",
    stateCode: "BE",
    countryCode: "DE",
    municipalityName: "Berlin",
    districtName: "Neukölln",
    confidenceScore: 90,
    geom: rectangle(13.4338, 52.47622, 13.4347, 52.47674),
    rawMetadata: {
      sourceSystem: "demo-cadastre",
      zoningHint: "inner courtyard site",
      intakeMode: "source-search",
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-berlin-moabit-005",
    providerName: "Demo Cadastre Index",
    providerParcelId: "BER-02-113-41",
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
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-hamburg-altona-006",
    providerName: "Demo Cadastre Index",
    providerParcelId: "HAM-03-781-22",
    displayName: "Altona station hinterland parcel",
    cadastralId: "22767-003-781/22",
    addressLine1: "Harkortstraße 67",
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
    },
  }),
  buildNormalizedSourceSearchResult({
    id: "cadastre-cologne-ehrenfeld-007",
    providerName: "Demo Cadastre Index",
    providerParcelId: "CGN-07-210-9",
    displayName: "Ehrenfeld workshop parcel",
    cadastralId: "50825-007-210/9",
    addressLine1: "Venloer Straße 364",
    city: "Köln",
    postalCode: "50825",
    stateCode: "NW",
    countryCode: "DE",
    municipalityName: "Köln",
    districtName: "Ehrenfeld",
    confidenceScore: 82,
    geom: null,
    landAreaSqm: "5180",
    rawMetadata: {
      sourceSystem: "demo-cadastre",
      intakeMode: "source-search",
      geometryStatus: "pending-digitization",
    },
  }),
];

function includesToken(value: string | null | undefined, token: string) {
  return typeof value === "string" && value.toLowerCase().includes(token);
}

const demoCadastreProvider: SourceParcelProvider = {
  key: "demo-cadastre",
  search(query?: string | null, municipality?: string | null, limit = 12) {
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
  },
  getByIds(sourceParcelIds: string[]) {
    const wanted = new Set(sourceParcelIds);
    return SOURCE_PARCELS.filter((parcel) => wanted.has(parcel.id));
  },
};

const PROVIDERS: SourceParcelProvider[] = [demoCadastreProvider];

export function searchSourceParcels(query?: string | null, municipality?: string | null, limit = 12) {
  const items = PROVIDERS.flatMap((provider) => provider.search(query, municipality, limit)).slice(0, Math.max(1, Math.min(limit, 50)));
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length || limit,
  };
}

export function getSourceParcelsByIds(sourceParcelIds: string[]) {
  return PROVIDERS.flatMap((provider) => provider.getByIds(sourceParcelIds));
}
