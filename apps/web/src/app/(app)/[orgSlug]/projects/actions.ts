"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ProjectDto } from "@repo/contracts";
import { apiFetch } from "@/lib/api/client";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildErrorRedirect(pathname: string, code: string, message?: string) {
  const search = new URLSearchParams();
  search.set("error", code);
  if (message) search.set("message", message.slice(0, 220));
  return `${pathname}?${search.toString()}`;
}

export async function createProjectFromParcelAction(orgSlug: string, formData: FormData) {
  const parcelId = optionalString(formData, "parcelId");
  if (!parcelId) {
    redirect(buildErrorRedirect(`/${orgSlug}/parcels`, "project-create-failed", "Select a parcel or site anchor first."));
  }

  try {
    const project = await apiFetch<ProjectDto>(orgSlug, "/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        parcelId,
        name: optionalString(formData, "projectName"),
        description: optionalString(formData, "projectDescription"),
      }),
    });

    revalidatePath(`/${orgSlug}/projects`);
    revalidatePath(`/${orgSlug}/parcels`);
    redirect(`/${orgSlug}/projects/${project.id}`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(`/${orgSlug}/parcels`, "project-create-failed", error.message));
    }

    throw error;
  }
}
