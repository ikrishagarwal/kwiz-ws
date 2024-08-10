import { describe, it, expect, expectTypeOf } from "vitest";
import { formatJson } from "#root/helpers";

describe("Format JSON Function", () => {
  it("should return a stringified JSON object", () => {
    const json = { key: "value" };
    expect(formatJson(json)).toBe('{"key":"value"}');
    expectTypeOf(formatJson(json)).toEqualTypeOf<string>();
  });
});
