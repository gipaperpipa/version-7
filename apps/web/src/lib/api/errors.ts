export class ApiUnavailableError extends Error {
  readonly code = "API_UNAVAILABLE";
  readonly url: string;

  constructor(message: string, url: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiUnavailableError";
    this.url = url;
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
