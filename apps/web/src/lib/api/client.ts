import "server-only";
import { LOCAL_DEV_DEMO_ORGANIZATION_SLUG } from "@repo/contracts";
import { cookies } from "next/headers";
import { ApiUnavailableError } from "./errors";
import { getConfiguredApiBaseUrl, isLocalDevFallbackEnabled } from "@/lib/local-dev";

type Membership = {
  organizationId: string;
  organizationSlug: string;
};

function parseMemberships(raw: string | undefined) {
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Membership[];
  } catch {
    return [];
  }
}

async function resolveOrganizationId(orgSlug: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("memberships_json")?.value;
  const memberships = parseMemberships(raw);
  const membership = memberships.find((item) => item.organizationSlug === orgSlug);

  if (membership) {
    return membership.organizationId;
  }

  if (isLocalDevFallbackEnabled() && orgSlug === LOCAL_DEV_DEMO_ORGANIZATION_SLUG) {
    return null;
  }

  throw new Error(`No organization membership found for slug "${orgSlug}"`);
}

export async function apiFetch<T>(orgSlug: string, path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const organizationId = await resolveOrganizationId(orgSlug);
  const apiBaseUrl = getConfiguredApiBaseUrl();

  if (!apiBaseUrl) {
    throw new ApiUnavailableError(
      "NEXT_PUBLIC_API_URL is not configured for this deployment.",
      "NEXT_PUBLIC_API_URL",
    );
  }

  const requestUrl = `${apiBaseUrl}${path}`;

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(organizationId ? { "x-organization-id": organizationId } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiUnavailableError(`Could not reach API at ${requestUrl}.`, requestUrl, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
