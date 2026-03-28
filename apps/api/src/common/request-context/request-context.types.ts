import type { Request } from "express";
import type { UserRole } from "../../../../../packages/contracts/dist/enums";

export interface JwtPrincipal {
  sub: string;
  email: string;
}

export interface TenantRequestContext {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPrincipal;
  tenantContext?: TenantRequestContext;
}
