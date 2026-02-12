import { describe, it, expect } from "vitest";
import { createBlipSchema, updateBlipSchema } from "./validations";

describe("createBlipSchema", () => {
  it("accepts valid content and optional categoryId", () => {
    expect(createBlipSchema.parse({ content: "A blip" })).toEqual({
      content: "A blip",
      categoryId: undefined,
    });
    expect(
      createBlipSchema.parse({ content: "With category", categoryId: "cat-1" })
    ).toEqual({ content: "With category", categoryId: "cat-1" });
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
