export type SafeProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
};

export type ProviderFetcher = typeof fetch;

type ProviderErrorOptions = {
  cause?: unknown;
  retryable?: boolean;
  status?: number;
};

export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: string, message: string, options: ProviderErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export function providerHttpError(provider: "OPENAI" | "ROBOFLOW", status: number) {
  const displayName = provider === "OPENAI" ? "OpenAI" : "Roboflow";

  if (status === 429) {
    return new ProviderError(
      `${provider}_RATE_LIMITED`,
      `${displayName} is temporarily busy. Try the scan again.`,
      { retryable: true, status },
    );
  }

  if (status >= 500) {
    return new ProviderError(
      `${provider}_UNAVAILABLE`,
      `${displayName} is temporarily unavailable. Try the scan again.`,
      { retryable: true, status },
    );
  }

  return new ProviderError(
    `${provider}_REJECTED`,
    `${displayName} could not process this image.`,
    { status },
  );
}

export function toSafeProviderError(error: unknown): SafeProviderError {
  if (error instanceof ProviderError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.status === undefined ? {} : { status: error.status }),
    };
  }

  return {
    code: "PROVIDER_FAILED",
    message: "The image provider could not complete this request.",
    retryable: false,
  };
}
