import { Prisma } from "@prisma/client";

export function toApiDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toApiDecimal(value: Prisma.Decimal | null | undefined): string | null {
  return value ? value.toString() : null;
}

export function toApiJson<T>(value: Prisma.JsonValue | null | undefined): T | null {
  return value == null ? null : (value as T);
}

export function toPrismaDecimal(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

export function toPrismaJson(value: unknown | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
