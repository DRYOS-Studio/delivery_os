import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMarkdown } from "@/components/ui/SafeMarkdown";

describe("SafeMarkdown", () => {
  it("renderiza headings e listas", () => {
    const html = renderToStaticMarkup(
      SafeMarkdown({ source: "## Escopo\n\n- Item A\n- Item B" }),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Escopo");
    expect(html).toContain("<ul");
    expect(html).toContain("Item A");
  });

  it("remove script injetado", () => {
    const html = renderToStaticMarkup(
      SafeMarkdown({ source: '<script>alert("x")</script>\n\nTexto ok' }),
    );
    expect(html).not.toContain("<script");
    expect(html).toContain("Texto ok");
  });
});