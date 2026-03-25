import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { AuthenticatedRequest, TenantRequestContext } from "./request-context.types";

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: AuthenticatedRequest) {}

  get tenant(): TenantRequestContext {
    if (!this.request.tenantContext) {
      throw new UnauthorizedException("Tenant context is missing on the request.");
    }
    return this.request.tenantContext;
  }

  get userId() {
    return this.tenant.userId;
  }

  get organizationId() {
    return this.tenant.organizationId;
  }

  get organizationSlug() {
    return this.tenant.organizationSlug;
  }

  get role() {
    return this.tenant.role;
  }
}
