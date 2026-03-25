import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../request-context/request-context.types";

@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.user;

    if (!principal?.sub) {
      throw new UnauthorizedException("Authenticated user is required.");
    }

    const requestedOrganizationId = request.header("x-organization-id") ?? undefined;
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId: principal.sub },
      include: { organization: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (!memberships.length) {
      throw new ForbiddenException("No organization membership found.");
    }

    const membership = requestedOrganizationId
      ? memberships.find((item) => item.organizationId === requestedOrganizationId)
      : memberships[0];

    if (!membership) {
      throw new ForbiddenException("Requested organization is not available to this user.");
    }

    request.tenantContext = {
      userId: principal.sub,
      organizationId: membership.organizationId,
      organizationSlug: membership.organization.slug,
      role: membership.role,
    };

    return true;
  }
}
