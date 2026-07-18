import { describe, expect, it } from "vitest";

import { ProviderError, toSafeProviderError } from "./provider-error";

describe("toSafeProviderError", () => {
  it("preserves an application-safe provider code without leaking its cause", () => {
    const error = new ProviderError(
      "OPENAI_RATE_LIMITED",
      "OpenAI is temporarily busy. Try the scan again.",
      { status: 429, retryable: true, cause: new Error("Bearer sk-private") },
    );

    expect(toSafeProviderError(error)).toEqual({
      code: "OPENAI_RATE_LIMITED",
      message: "OpenAI is temporarily busy. Try the scan again.",
      retryable: true,
      status: 429,
    });
  });

  it("maps unknown failures to a generic safe message", () => {
    expect(toSafeProviderError(new Error("api_key=secret"))).toEqual({
      code: "PROVIDER_FAILED",
      message: "The image provider could not complete this request.",
      retryable: false,
    });
  });
});
