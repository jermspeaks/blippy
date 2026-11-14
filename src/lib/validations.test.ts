import { describe, it, expect } from "vitest";
import { createBlipSchema, updateBlipSchema } from "./validations";

describe("createBlipSchema", () => {
  it("accepts valid content", () => {
    expect(createBlipSchema.parse({ content: "A blip" })).toEqual({
      content: "A blip",
    });
  });

  it("rejects empty content", () => {
    expect(() => createBlipSchema.parse({ content: "" })).toThrow();
  });
});

describe("updateBlipSchema", () => {
  it("accepts partial updates", () => {
    expect(updateBlipSchema.parse({ content: "Updated" })).toEqual({
      content: "Updated",
    });
    expect(updateBlipSchema.parse({ status: "fizzled" })).toEqual({
      status: "fizzled",
    });
  });
});
