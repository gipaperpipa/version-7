import "server-only";
import { cookies } from "next/headers";

type Membership = {
  organizationId: string;
  organizationSlug: string;
};

function resolveOrganizationId(orgSlug: string) {
  const raw = cookies().get("memberships_json")?.value;
  const memberships: Membership[] = raw ? JSON.parse(raw) : [];
  const membership = memberships.find((item) => item.organizationSlug === orgSlug);

  if (!membership) {
    throw new Error(`No organization membership found for slug "${orgSlug}"`);
  }

  return membership.organizationId;
}

export async function apiFetch<T>(orgSlug: string, path: string, init?: RequestInit): Promise<T> {
  const accessToken = cookies().get("access_token")?.value;
  const organizationId = resolveOrganizationId(orgSlug);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": organizationId,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
