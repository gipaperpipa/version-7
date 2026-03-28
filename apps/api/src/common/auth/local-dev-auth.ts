import {
  LOCAL_DEV_DEMO_USER_EMAIL,
  LOCAL_DEV_DEMO_USER_ID,
} from "../../../../../packages/contracts/dist/local-dev";
import type { JwtPrincipal } from "../request-context/request-context.types";

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

export function isLocalDevAuthFallbackEnabled() {
  if (typeof process.env.ENABLE_DEMO_FALLBACK === "string") {
    return isTruthy(process.env.ENABLE_DEMO_FALLBACK);
  }

  return process.env.NODE_ENV !== "production";
}

export function getLocalDevPrincipal(): JwtPrincipal {
  return {
    sub: LOCAL_DEV_DEMO_USER_ID,
    email: LOCAL_DEV_DEMO_USER_EMAIL,
  };
}
