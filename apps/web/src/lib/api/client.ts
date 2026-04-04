import "server-only";
import { LOCAL_DEV_DEMO_ORGANIZATION_SLUG } from "@repo/contracts";
import { cookies } from "next/headers";
import { ApiResponseError, ApiUnavailableError } from "./errors";
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

function extractApiErrorMessage(status: number, body: unknown) {
  if (typeof body === "string" && body.trim()) return body.trim();

  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (Array.isArray(record.message)) {
      const joined = record.message.filter((item): item is string => typeof item === "string").join(" ");
      if (joined) return joined;
    }

    if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
    if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  }

  if (status === 422) return "The API rejected the request because the scenario is not currently runnable.";
  if (status === 404) return "The requested scenario data could not be found.";
  if (status >= 500) return "The API failed while processing this request.";
  return `API request failed with status ${status}.`;
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

  const rawText = await response.text();
  let parsedBody: unknown = null;

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText) as unknown;
    } catch {
      parsedBody = rawText;
    }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiUnavailableError(
        extractApiErrorMessage(response.status, parsedBody),
        requestUrl,
        { cause: parsedBody },
      );
    }

    throw new ApiResponseError(
      extractApiErrorMessage(response.status, parsedBody),
      response.status,
      requestUrl,
      parsedBody,
    );
  }

  if (!rawText) {
    throw new ApiResponseError(
      "The API returned an empty success response where JSON was expected.",
      response.status,
      requestUrl,
      null,
    );
  }

  if (typeof parsedBody === "string") {
    throw new ApiResponseError(
      "The API returned a non-JSON success response where JSON was expected.",
      response.status,
      requestUrl,
      parsedBody,
    );
  }

  return parsedBody as T;
}
