import { Injectable, NotFoundException, Scope } from "@nestjs/common";
import type {
  CreateParcelRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
  UpdateParcelRequestDto,
} from "@repo/contracts";
import { normalizePolygonGeometryToMultiPolygon } from "../../common/geo/polygon-normalization";
import { toApiDate, toApiDecimal, toApiJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

@Injectable({ scope: Scope.REQUEST })
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(params: { page: number; pageSize: number }): Promise<ListParcelsResponseDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.parcel.findMany({
        where: { organizationId: this.requestContext.organizationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.parcel.count({
        where: { organizationId: this.requestContext.organizationId },
      }),
    ]);

    return {
      items: items.map((item) => this.mapParcel(item)),
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateParcelRequestDto): Promise<ParcelDto> {
    const created = await this.prisma.parcel.create({
      data: {
        organizationId: this.requestContext.organizationId,
        name: dto.name ?? null,
        cadastralId: dto.cadastralId ?? null,
        addressLine1: dto.addressLine1 ?? null,
        city: dto.city ?? null,
        postalCode: dto.postalCode ?? null,
        stateCode: dto.stateCode ?? null,
        countryCode: dto.countryCode ?? "DE",
        municipalityName: dto.municipalityName ?? null,
        districtName: dto.districtName ?? null,
        landAreaSqm: dto.landAreaSqm ?? null,
        sourceType: dto.sourceType,
        sourceReference: dto.sourceReference ?? null,
        confidenceScore: dto.confidenceScore ?? null,
        geom: normalizePolygonGeometryToMultiPolygon(dto.geom) ?? null,
      },
    });

    return this.mapParcel(created);
  }

  async getById(parcelId: string): Promise<ParcelDto> {
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        id: parcelId,
        organizationId: this.requestContext.organizationId,
      },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    return this.mapParcel(parcel);
  }

  async update(parcelId: string, dto: UpdateParcelRequestDto): Promise<ParcelDto> {
    await this.assertParcelAccess(parcelId);

    const updated = await this.prisma.parcel.update({
      where: { id: parcelId },
      data: {
        name: dto.name,
        cadastralId: dto.cadastralId,
        addressLine1: dto.addressLine1,
        city: dto.city,
        postalCode: dto.postalCode,
        stateCode: dto.stateCode,
        countryCode: dto.countryCode,
        municipalityName: dto.municipalityName,
        districtName: dto.districtName,
        landAreaSqm: dto.landAreaSqm === undefined ? undefined : dto.landAreaSqm,
        sourceReference: dto.sourceReference,
        confidenceScore: dto.confidenceScore,
        geom: "geom" in dto ? normalizePolygonGeometryToMultiPolygon(dto.geom) : undefined,
      },
    });

    return this.mapParcel(updated);
  }

  private async assertParcelAccess(parcelId: string) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { id: parcelId, organizationId: this.requestContext.organizationId },
      select: { id: true },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }
  }

  private mapParcel(parcel: {
    id: string;
    organizationId: string;
    name: string | null;
    cadastralId: string | null;
    addressLine1: string | null;
    city: string | null;
    postalCode: string | null;
    stateCode: string | null;
    countryCode: string | null;
    municipalityName: string | null;
    districtName: string | null;
    landAreaSqm: { toString(): string } | null;
    sourceType: ParcelDto["sourceType"];
    sourceReference: string | null;
    confidenceScore: number | null;
    geom: unknown | null;
    centroid: unknown | null;
    createdAt: Date;
    updatedAt: Date;
  }): ParcelDto {
    return {
      id: parcel.id,
      organizationId: parcel.organizationId,
      name: parcel.name,
      cadastralId: parcel.cadastralId,
      addressLine1: parcel.addressLine1,
      city: parcel.city,
      postalCode: parcel.postalCode,
      stateCode: parcel.stateCode,
      countryCode: parcel.countryCode,
      municipalityName: parcel.municipalityName,
      districtName: parcel.districtName,
      landAreaSqm: toApiDecimal(parcel.landAreaSqm as never),
      sourceType: parcel.sourceType,
      sourceReference: parcel.sourceReference,
      confidenceScore: parcel.confidenceScore,
      geom: toApiJson(parcel.geom),
      centroid: toApiJson(parcel.centroid),
      createdAt: toApiDate(parcel.createdAt)!,
      updatedAt: toApiDate(parcel.updatedAt)!,
    };
  }
}
