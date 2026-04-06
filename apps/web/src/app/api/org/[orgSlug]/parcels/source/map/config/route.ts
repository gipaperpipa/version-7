import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await context.params;

  try {
    const payload = await apiFetch(orgSlug, "/api/v1/parcels/source/map/config");
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiResponseError(error)) {
      return NextResponse.json({
        code: error.code,
        message: error.message,
        body: error.body,
      }, { status: error.status });
    }

    if (isApiUnavailableError(error)) {
      return NextResponse.json({
        code: error.code,
        message: error.message,
      }, { status: 503 });
    }

    throw error;
  }
}
