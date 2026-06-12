import { describe, it, expect } from "vitest";
import { renderTemplate, ensureRe, textToHtml } from "@/lib/email/template";

describe("renderTemplate", () => {
  it("substitutes brand and contact", () => {
    expect(renderTemplate("Hi {{contact_name_or_team}}, re {{brand}}", { brand: "PILOT", contact: "Ana" }))
      .toBe("Hi Ana, re PILOT");
  });
  it("empty opening_hook collapses the blank paragraph", () => {
    const src = "Hi {{contact_name_or_team}},\n\n{{opening_hook}}\n\nBody text.";
    expect(renderTemplate(src, { brand: "X", contact: "there" })).toBe("Hi there,\n\nBody text.");
  });
  it("filled opening_hook stays", () => {
    const src = "Hi,\n\n{{opening_hook}}\n\nBody.";
    expect(renderTemplate(src, { brand: "X", contact: "t", openingHook: "Nice fact." }))
      .toBe("Hi,\n\nNice fact.\n\nBody.");
  });
  it("unknown placeholder becomes empty", () =>
    expect(renderTemplate("a {{nope}} b", { brand: "X", contact: "t" })).toBe("a  b"));
});

describe("ensureRe", () => {
  it("adds Re: once", () => expect(ensureRe("Subject")).toBe("Re: Subject"));
  it("does not duplicate", () => expect(ensureRe("Re: Subject")).toBe("Re: Subject"));
  it("case-insensitive", () => expect(ensureRe("RE: Subject")).toBe("RE: Subject"));
});

describe("textToHtml", () => {
  it("escapes and wraps paragraphs", () =>
    expect(textToHtml("A & B\n\nC<d>")).toBe("<p>A &amp; B</p>\n<p>C&lt;d&gt;</p>"));
  it("single newline becomes <br/>", () =>
    expect(textToHtml("l1\nl2")).toBe("<p>l1<br/>l2</p>"));
});
