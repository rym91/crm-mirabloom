import { describe, it, expect } from "vitest";
import { isFormOnly, formAlias, formTaskBody } from "./form-outreach";

describe("isFormOnly", () => {
  it("true: form url and no email contact", () => expect(isFormOnly(true, false)).toBe(true));
  it("false: has email contact", () => expect(isFormOnly(true, true)).toBe(false));
  it("false: no form url", () => expect(isFormOnly(false, false)).toBe(false));
});

describe("formAlias", () => {
  it("builds lead-<id>@domain", () =>
    expect(formAlias("cmqg123", "mirabloom.eu")).toBe("lead-cmqg123@mirabloom.eu"));
});

describe("formTaskBody", () => {
  it("includes brands, form url and the alias instruction", () => {
    const body = formTaskBody("DJECO SAS", ["DJECO"], "https://djeco.com/contact", "lead-x@mirabloom.eu");
    expect(body).toContain("DJECO");
    expect(body).toContain("https://djeco.com/contact");
    expect(body).toContain("lead-x@mirabloom.eu");
  });
  it("falls back to supplier name when no brands", () => {
    expect(formTaskBody("Acme", [], null, "lead-y@mirabloom.eu")).toContain("Acme");
  });
});
