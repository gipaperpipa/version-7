import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  CreateProjectRequestDto,
  ListProjectsResponseDto,
  ProjectDto,
  UpdateProjectRequestDto,
} from "../../generated-contracts/projects";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OrgScopeGuard } from "../../common/auth/org-scope.guard";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiBearerAuth()
@ApiHeader({
  name: "x-organization-id",
  required: false,
  description: "Active organization id. Falls back to the user's default membership.",
})
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Version("1")
  list(@Query("page") page = "1", @Query("pageSize") pageSize = "20"): Promise<ListProjectsResponseDto> {
    return this.projectsService.list({ page: Number(page), pageSize: Number(pageSize) });
  }

  @Post()
  @Version("1")
  create(@Body() dto: CreateProjectRequestDto): Promise<ProjectDto> {
    return this.projectsService.create(dto);
  }

  @Get(":projectId")
  @Version("1")
  getById(@Param("projectId") projectId: string): Promise<ProjectDto> {
    return this.projectsService.getById(projectId);
  }

  @Patch(":projectId")
  @Version("1")
  update(@Param("projectId") projectId: string, @Body() dto: UpdateProjectRequestDto): Promise<ProjectDto> {
    return this.projectsService.update(projectId, dto);
  }
}
