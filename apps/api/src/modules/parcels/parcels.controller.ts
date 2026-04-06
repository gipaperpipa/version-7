import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  CreateParcelRequestDto,
  CreateSourceParcelIntakeRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
  SourceParcelMapConfigDto,
  SourceParcelMapPreviewsResponseDto,
  SearchSourceParcelsResponseDto,
  SourceParcelIntakeResponseDto,
  UpdateParcelRequestDto,
} from "../../generated-contracts/parcels";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { ParcelsService } from "./parcels.service";

@ApiTags("parcels")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller("parcels")
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Get()
  @Version("1")
  list(@Query("page") page = "1", @Query("pageSize") pageSize = "20"): Promise<ListParcelsResponseDto> {
    return this.parcelsService.list({ page: Number(page), pageSize: Number(pageSize) });
  }

  @Get("source/search")
  @Version("1")
  searchSource(
    @Query("q") query?: string,
    @Query("municipality") municipality?: string,
    @Query("limit") limit = "12",
  ): Promise<SearchSourceParcelsResponseDto> {
    return this.parcelsService.searchSource(query, municipality, Number(limit));
  }

  @Get("source/map/config")
  @Version("1")
  getSourceMapConfig(): Promise<SourceParcelMapConfigDto> {
    return this.parcelsService.getSourceMapConfig();
  }

  @Get("source/map/previews")
  @Version("1")
  getSourceMapPreviews(
    @Query("west") west?: string,
    @Query("south") south?: string,
    @Query("east") east?: string,
    @Query("north") north?: string,
    @Query("zoom") zoom = "0",
    @Query("limit") limit = "120",
  ): Promise<SourceParcelMapPreviewsResponseDto> {
    return this.parcelsService.getSourceMapPreviews({
      west: Number(west),
      south: Number(south),
      east: Number(east),
      north: Number(north),
    }, Number(zoom), Number(limit));
  }

  @Post("source/intake")
  @Version("1")
  intakeSource(@Body() dto: CreateSourceParcelIntakeRequestDto): Promise<SourceParcelIntakeResponseDto> {
    return this.parcelsService.intakeFromSource(dto);
  }

  @Post()
  @Version("1")
  create(@Body() dto: CreateParcelRequestDto): Promise<ParcelDto> {
    return this.parcelsService.create(dto);
  }

  @Get(":parcelId")
  @Version("1")
  getById(@Param("parcelId") parcelId: string): Promise<ParcelDto> {
    return this.parcelsService.getById(parcelId);
  }

  @Patch(":parcelId")
  @Version("1")
  update(@Param("parcelId") parcelId: string, @Body() dto: UpdateParcelRequestDto): Promise<ParcelDto> {
    return this.parcelsService.update(parcelId, dto);
  }
}
