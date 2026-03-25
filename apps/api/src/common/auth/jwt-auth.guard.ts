import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../request-context/request-context.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.sub) {
      throw new UnauthorizedException("Authenticated user is required.");
    }
    return true;
  }
}
