import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  CreateParcelRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
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
