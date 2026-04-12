import { ConflictException, Injectable, NotFoundException, Scope } from "@nestjs/common";
import { type ProjectStatus, type SourceType } from "@prisma/client";
import type {
  CreateProjectRequestDto,
  ListProjectsResponseDto,
  ProjectDto,
  UpdateProjectRequestDto,
} from "../../generated-contracts/projects";
import { toApiDate, toApiDecimal, toApiJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

function getConfidenceBand(score: number | null | undefined): ProjectDto["anchorParcel"]["confidenceBand"] {
  if (score == null) return "UNSCORED";
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function deriveSourceAuthority(parcel: {
  sourceType: SourceType;
  provenanceJson: unknown | null;
}): ProjectDto["anchorParcel"]["sourceAuthority"] {
  const provenance = toApiJson<Record<string, unknown>>(parcel.provenanceJson as never);
  const authority = provenance && typeof provenance.sourceAuthority === "string" ? provenance.sourceAuthority : null;
  if (authority === "DEMO" || authority === "SEARCH_GRADE" || authority === "CADASTRAL_GRADE") {
    return authority;
  }

  switch (parcel.sourceType) {
    case "GIS_CADASTRE":
      return "CADASTRAL_GRADE";
    case "THIRD_PARTY_API":
      return "SEARCH_GRADE";
    case "IMPORT":
      return "DEMO";
    default:
      return null;
  }
}

type ProjectRecord = Awaited<ReturnType<ProjectsService["getProjectRecordOrThrow"]>>;

@Injectable({ scope: Scope.REQUEST })
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(params: { page: number; pageSize: number }): Promise<ListProjectsResponseDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where: { organizationId: this.requestContext.organizationId },
        include: {
          anchorParcel: true,
          scenarios: {
            select: {
              id: true,
              governanceStatus: true,
              latestRunAt: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({
        where: { organizationId: this.requestContext.organizationId },
      }),
    ]);

    return {
      items: items.map((item) => this.mapProject(item)),
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateProjectRequestDto): Promise<ProjectDto> {
    const anchor = await this.resolveProjectAnchor(dto.parcelId);
    return this.ensureProjectForAnchor(anchor.parcelId, {
      anchorParcelGroupId: anchor.parcelGroupId,
      name: dto.name ?? null,
      description: dto.description ?? null,
      status: dto.status ?? "ACTIVE",
    });
  }

  async getById(projectId: string): Promise<ProjectDto> {
    const project = await this.getProjectRecordOrThrow(projectId);
    return this.mapProject(project);
  }

  async update(projectId: string, dto: UpdateProjectRequestDto): Promise<ProjectDto> {
    await this.getProjectRecordOrThrow(projectId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name === undefined ? undefined : dto.name?.trim() || undefined,
        description: dto.description === undefined ? undefined : dto.description,
        status: dto.status,
      },
      include: {
        anchorParcel: true,
        scenarios: {
          select: {
            id: true,
            governanceStatus: true,
            latestRunAt: true,
          },
        },
      },
    });

    return this.mapProject(updated);
  }

  async getByAnchorParcelId(anchorParcelId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        organizationId: this.requestContext.organizationId,
        anchorParcelId,
      },
      include: {
        anchorParcel: true,
        scenarios: {
          select: {
            id: true,
            governanceStatus: true,
            latestRunAt: true,
          },
        },
      },
    });

    return project ? this.mapProject(project) : null;
  }

  async ensureProjectForAnchor(
    anchorParcelId: string,
    options?: {
      anchorParcelGroupId?: string | null;
      name?: string | null;
      description?: string | null;
      status?: ProjectStatus;
    },
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.findFirst({
      where: {
        organizationId: this.requestContext.organizationId,
        anchorParcelId,
      },
      include: {
        anchorParcel: true,
        scenarios: {
          select: {
            id: true,
            governanceStatus: true,
            latestRunAt: true,
          },
        },
      },
    });

    if (existing) {
      return this.mapProject(existing);
    }

    const anchorParcel = await this.prisma.parcel.findFirst({
      where: {
        id: anchorParcelId,
        organizationId: this.requestContext.organizationId,
      },
      select: {
        id: true,
        parcelGroupId: true,
        isGroupSite: true,
        name: true,
        cadastralId: true,
        addressLine1: true,
        municipalityName: true,
        city: true,
      },
    });

    if (!anchorParcel) {
      throw new NotFoundException("Project anchor parcel not found.");
    }

    const created = await this.prisma.project.create({
      data: {
        organizationId: this.requestContext.organizationId,
        anchorParcelId,
        anchorParcelGroupId: options?.anchorParcelGroupId ?? anchorParcel.parcelGroupId ?? null,
        name: options?.name?.trim() || this.buildProjectName(anchorParcel),
        description: options?.description ?? null,
        status: options?.status ?? "ACTIVE",
      },
      include: {
        anchorParcel: true,
        scenarios: {
          select: {
            id: true,
            governanceStatus: true,
            latestRunAt: true,
          },
        },
      },
    });

    return this.mapProject(created);
  }

  async getAccessibleProjectAnchor(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: this.requestContext.organizationId,
      },
      select: {
        id: true,
        anchorParcelId: true,
        anchorParcelGroupId: true,
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found.");
    }

    return project;
  }

  private async getProjectRecordOrThrow(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: this.requestContext.organizationId,
      },
      include: {
        anchorParcel: true,
        scenarios: {
          select: {
            id: true,
            governanceStatus: true,
            latestRunAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found.");
    }

    return project;
  }

  private async resolveProjectAnchor(parcelId: string) {
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        id: parcelId,
        organizationId: this.requestContext.organizationId,
      },
      select: {
        id: true,
        parcelGroupId: true,
        isGroupSite: true,
        parcelGroup: {
          select: {
            id: true,
            siteParcelId: true,
            siteParcel: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found.");
    }

    if (parcel.parcelGroupId && !parcel.isGroupSite) {
      if (!parcel.parcelGroup?.siteParcel?.id && !parcel.parcelGroup?.siteParcelId) {
        throw new ConflictException("This parcel is already a grouped-site member but its site anchor could not be resolved.");
      }

      return {
        parcelId: parcel.parcelGroup?.siteParcel?.id ?? parcel.parcelGroup?.siteParcelId ?? parcel.id,
        parcelGroupId: parcel.parcelGroupId,
      };
    }

    return {
      parcelId: parcel.id,
      parcelGroupId: parcel.parcelGroupId ?? null,
    };
  }

  private buildProjectName(anchorParcel: {
    isGroupSite: boolean;
    name: string | null;
    cadastralId: string | null;
    addressLine1: string | null;
    municipalityName: string | null;
    city: string | null;
  }) {
    const baseLabel = anchorParcel.name
      ?? anchorParcel.cadastralId
      ?? anchorParcel.addressLine1
      ?? anchorParcel.municipalityName
      ?? anchorParcel.city
      ?? "Untitled site";

    return anchorParcel.isGroupSite ? baseLabel : `${baseLabel} project`;
  }

  private mapProject(item: NonNullable<ProjectRecord>) {
    const activeScenarioCount = item.scenarios.filter((scenario) => scenario.governanceStatus !== "ARCHIVED").length;
    const latestScenarioRunAt = [...item.scenarios]
      .map((scenario) => scenario.latestRunAt)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      id: item.id,
      organizationId: item.organizationId,
      anchorParcelId: item.anchorParcelId,
      anchorParcelGroupId: item.anchorParcelGroupId ?? null,
      name: item.name,
      description: item.description,
      status: item.status,
      anchorParcel: {
        id: item.anchorParcel.id,
        parcelGroupId: item.anchorParcel.parcelGroupId ?? null,
        isGroupSite: Boolean(item.anchorParcel.isGroupSite),
        name: item.anchorParcel.name,
        cadastralId: item.anchorParcel.cadastralId,
        municipalityName: item.anchorParcel.municipalityName,
        city: item.anchorParcel.city,
        landAreaSqm: toApiDecimal(item.anchorParcel.landAreaSqm),
        confidenceScore: item.anchorParcel.confidenceScore ?? null,
        confidenceBand: getConfidenceBand(item.anchorParcel.confidenceScore ?? null),
        sourceAuthority: deriveSourceAuthority(item.anchorParcel),
      },
      scenarioCount: item.scenarios.length,
      activeScenarioCount,
      latestScenarioRunAt: toApiDate(latestScenarioRunAt),
      createdAt: toApiDate(item.createdAt)!,
      updatedAt: toApiDate(item.updatedAt)!,
    } satisfies ProjectDto;
  }
}
