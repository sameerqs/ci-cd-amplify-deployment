import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const globalsCss = readFileSync(path.join(projectRoot, "app/globals.css"), "utf8");

function blockOf(selector: string): string {
  const start = globalsCss.indexOf(`${selector} {`);
  expect(start, `${selector} block missing from globals.css`).toBeGreaterThan(-1);
  const end = globalsCss.indexOf("\n}", start);
  return globalsCss.slice(start, end);
}

function classOf(markup: string): string {
  return /class="([^"]*)"/.exec(markup)?.[1] ?? "";
}

describe("design-system surfaces", () => {
  const rootBlock = blockOf(":root");
  const darkBlock = blockOf(".dark");

  it("defines --surface as the design's --color-surface, distinct from --card", () => {
    expect(rootBlock).toContain("--surface: #ebddc5");
    expect(rootBlock).toContain("--card: #ffffff");
  });

  it("defines --ground as the design's --color-bg for the desktop rail", () => {
    expect(rootBlock).toContain("--ground: #f5ead8");
  });

  it("defines --divider as a translucent ink, not a flat neutral", () => {
    expect(/--divider:\s*color-mix\(/.test(rootBlock)).toBe(true);
  });

  it("re-hues all three for dark mode", () => {
    expect(darkBlock).toContain("--surface:");
    expect(darkBlock).toContain("--ground:");
    expect(darkBlock).toContain("--divider:");
    expect(darkBlock).not.toContain("--surface: #ebddc5");
  });

  it("exposes them to Tailwind", () => {
    expect(globalsCss).toContain("--color-surface: var(--surface)");
    expect(globalsCss).toContain("--color-ground: var(--ground)");
    expect(globalsCss).toContain("--color-divider: var(--divider)");
  });
});

describe("brand tokens", () => {
  const rootBlock = blockOf(":root");

  it.each([
    ["--background", "#f9f4ed"],
    ["--foreground", "#201e1d"],
    ["--card", "#ffffff"],
    ["--popover", "#ffffff"],
    ["--primary", "#c67139"],
    ["--primary-foreground", "#f9f4ed"],
    ["--secondary", "#eee7db"],
    ["--accent", "#ffe1d0"],
    ["--accent-foreground", "#643312"],
    ["--muted", "#eee7db"],
    ["--muted-foreground", "#82796a"],
    ["--border", "#dcd3c4"],
    ["--input", "#dcd3c4"],
    ["--ring", "#c67139"],
    ["--radius", "1.75rem"],
  ])("%s resolves to %s in :root", (token, value) => {
    expect(rootBlock).toMatch(new RegExp(`\\n\\s*${token}:\\s*${value};`));
  });

  it("exposes the full neutral, accent and accent-2 ramps", () => {
    for (const ramp of ["neutral", "accent", "accent-2"]) {
      for (let stop = 100; stop <= 900; stop += 100) {
        expect(rootBlock).toMatch(
          new RegExp(`\\n\\s*--${ramp}-${stop}:\\s*#[0-9a-f]{6};`),
        );
      }
    }
  });

  it("re-themes every semantic slot in .dark rather than inheriting :root", () => {
    const darkBlock = blockOf(".dark");
    for (const token of [
      "--background",
      "--foreground",
      "--card",
      "--primary",
      "--secondary",
      "--accent",
      "--muted",
      "--muted-foreground",
      "--border",
      "--ring",
    ]) {
      expect(darkBlock).toMatch(new RegExp(`\\n\\s*${token}:`));
    }
    expect(darkBlock).not.toContain("--background: #f9f4ed");
  });

  it("wires the brand fonts into the theme", () => {
    expect(globalsCss).toContain("--font-sans: var(--font-figtree)");
    expect(globalsCss).toContain("--font-heading: var(--font-caprasimo)");
    expect(globalsCss).toMatch(/h1, h2, h3, h4, h5, h6 \{\s*font-family: var\(--font-heading\);/);
  });
});

describe("pill controls", () => {
  it("renders a fully pill-shaped button", () => {
    const className = classOf(renderToStaticMarkup(React.createElement(Button, null, "Save")));
    expect(className).toContain("rounded-full");
    expect(className).not.toMatch(/\brounded-(md|sm|lg|xl|\[)/);
  });

  it("keeps every button size pill-shaped", () => {
    for (const size of ["sm", "lg"] as const) {
      const className = classOf(
        renderToStaticMarkup(React.createElement(Button, { size }, "Save")),
      );
      expect(className).toContain("rounded-full");
      expect(className).not.toMatch(/\brounded-(md|sm)\b/);
    }
  });

  it("renders a fully pill-shaped input", () => {
    const className = classOf(renderToStaticMarkup(React.createElement(Input, { type: "text" })));
    expect(className).toContain("rounded-full");
    expect(className).not.toMatch(/\brounded-\[/);
  });
});

describe("no color literals outside globals.css", () => {
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\([0-9]/;

  // global-error.tsx replaces the document and never loads globals.css, so its
  // hex values are var() fallbacks; chart.tsx matches recharts' own emitted
  // stroke attributes in selectors, not authored colors.
  const ALLOWED = new Set(["app/global-error.tsx", "components/ui/chart.tsx"]);

  function walk(dir: string): string[] {
    return readdirSync(path.join(projectRoot, dir)).flatMap((entry) => {
      const rel = `${dir}/${entry}`;
      if (statSync(path.join(projectRoot, rel)).isDirectory()) return walk(rel);
      return /\.tsx?$/.test(entry) && !entry.includes(".test.") ? [rel] : [];
    });
  }

  it.each(["app", "components", "lib"])("%s routes color through tokens", (dir) => {
    const offenders = walk(dir).filter(
      (rel) => !ALLOWED.has(rel) && LITERAL.test(readFileSync(path.join(projectRoot, rel), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
