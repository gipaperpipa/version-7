import {
  LOCAL_DEV_DEMO_ORGANIZATION_NAME,
  LOCAL_DEV_DEMO_ORGANIZATION_SLUG,
} from "@repo/contracts";

export const localDevDemoWorkspace = {
  name: LOCAL_DEV_DEMO_ORGANIZATION_NAME,
  slug: LOCAL_DEV_DEMO_ORGANIZATION_SLUG,
};

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

export function isLocalDevFallbackEnabled() {
  if (typeof process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === "string") {
    return isTruthy(process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK);
  }

  return process.env.NODE_ENV !== "production";
}

export function getConfiguredApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }

  return null;
}
