import { describe, it, expect } from "vitest";
import { extractRoutingToken, extractMessageIds, normalizeSubject, extractSupplierAlias } from "@/lib/email/resolve";

describe("extractRoutingToken", () => {
  it("finds our token in In-Reply-To", () =>
    expect(extractRoutingToken("<cmb9x7abc123.lq2r4@mirabloom.eu>", null)).toBe("cmb9x7abc123"));
  it("finds it among foreign ids in References", () =>
    expect(extractRoutingToken("<xyz@gmail.com>", "<a1@x.com> <cmb9tok.r1@mirabloom.eu>")).toBe("cmb9tok"));
  it("null when absent", () => expect(extractRoutingToken("<foreign@gmail.com>", null)).toBeNull());
});

describe("extractMessageIds", () => {
  it("collects bracketed ids", () =>
    expect(extractMessageIds("<a@b>", "<c@d> <e@f>")).toEqual(["<a@b>", "<c@d>", "<e@f>"]));
  it("empty on nulls", () => expect(extractMessageIds(null, undefined)).toEqual([]));
});

describe("extractSupplierAlias", () => {
  it("recovers supplierId from a plain alias", () =>
    expect(extractSupplierAlias("lead-cmqg123abc@mirabloom.eu")).toBe("cmqg123abc"));
  it("recovers from a display-name To header", () =>
    expect(extractSupplierAlias('Sales <lead-cmqg9z9@mirabloom.eu>')).toBe("cmqg9z9"));
  it("ignores a normal address", () =>
    expect(extractSupplierAlias("hello@mirabloom.eu")).toBeNull());
  it("null on empty", () => expect(extractSupplierAlias(null, undefined)).toBeNull());
  it("scans multiple recipients", () =>
    expect(extractSupplierAlias("hello@mirabloom.eu, lead-abc123@mirabloom.eu")).toBe("abc123"));
});

describe("normalizeSubject", () => {
  it("strips reply prefixes iteratively", () =>
    expect(normalizeSubject("Re: RE: Fwd: Ответ: Wholesale account")).toBe("wholesale account"));
  it("plain subject lowercased", () => expect(normalizeSubject("  Hello THERE ")).toBe("hello there"));
});
