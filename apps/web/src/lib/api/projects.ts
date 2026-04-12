import type {
  CreateProjectRequestDto,
  ListProjectsResponseDto,
  ProjectDto,
  UpdateProjectRequestDto,
} from "@repo/contracts";
import { apiFetch } from "./client";

export function getProjects(orgSlug: string) {
  return apiFetch<ListProjectsResponseDto>(orgSlug, "/api/v1/projects");
}

export function getProject(orgSlug: string, projectId: string) {
  return apiFetch<ProjectDto>(orgSlug, `/api/v1/projects/${projectId}`);
}

export function createProject(orgSlug: string, payload: CreateProjectRequestDto) {
  return apiFetch<ProjectDto>(orgSlug, "/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProject(orgSlug: string, projectId: string, payload: UpdateProjectRequestDto) {
  return apiFetch<ProjectDto>(orgSlug, `/api/v1/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
