import { describe, it, expect } from "vitest";
import { domainOf, matchSupplierByDomain } from "./import-dedup";

describe("domainOf", () => {
  it("strips scheme and www, lowercases", () => {
    expect(domainOf("https://www.Acme-EU.com/distributors")).toBe("acme-eu.com");
    expect(domainOf("acme.com")).toBe("acme.com");
  });
  it("handles null/empty", () => {
    expect(domainOf(null)).toBeNull();
    expect(domainOf("")).toBeNull();
    expect(domainOf("   ")).toBeNull();
  });
});

describe("matchSupplierByDomain (exact, not substring)", () => {
  it("does NOT merge acme.com into myacme.com", () => {
    const suppliers = [{ id: "1", website: "https://myacme.com" }];
    expect(matchSupplierByDomain(suppliers, "acme.com")).toBeNull();
  });
  it("does NOT merge across TLD variants", () => {
    const suppliers = [{ id: "1", website: "https://oracdecor.com.es" }];
    expect(matchSupplierByDomain(suppliers, "oracdecor.com")).toBeNull();
  });
  it("matches exact domain regardless of path/www", () => {
    const suppliers = [
      { id: "1", website: "https://myacme.com" },
      { id: "2", website: "https://www.acme.com/distributors" },
    ];
    const m = matchSupplierByDomain(suppliers, "acme.com");
    expect(m?.id).toBe("2");
  });
  it("tolerates null website rows", () => {
    const suppliers = [{ id: "1", website: null }, { id: "2", website: "acme.com" }];
    expect(matchSupplierByDomain(suppliers, "acme.com")?.id).toBe("2");
  });
  it("returns null when no exact match", () => {
    expect(matchSupplierByDomain([{ id: "1", website: "other.de" }], "acme.com")).toBeNull();
  });
});
