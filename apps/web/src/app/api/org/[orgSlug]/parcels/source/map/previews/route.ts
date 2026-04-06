import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";

  try {
    const payload = await apiFetch(orgSlug, `/api/v1/parcels/source/map/previews${suffix}`);
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
