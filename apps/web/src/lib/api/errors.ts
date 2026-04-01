export class ApiUnavailableError extends Error {
  readonly code = "API_UNAVAILABLE";
  readonly url: string;

  constructor(message: string, url: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiUnavailableError";
    this.url = url;
  }
}

export class ApiResponseError extends Error {
  readonly code = "API_RESPONSE_ERROR";
  readonly url: string;
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, url: string, body: unknown, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiResponseError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export function isApiUnavailableError(error: unknown): error is ApiUnavailableError {
  return (
    error instanceof ApiUnavailableError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "API_UNAVAILABLE")
  );
}

export function isApiResponseError(error: unknown): error is ApiResponseError {
  return (
    error instanceof ApiResponseError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "API_RESPONSE_ERROR")
  );
}
