import assert from "node:assert/strict";
import test from "node:test";

import {
  getGlassTintOpacity,
  getGlassContentOpacity,
  isSvsTheme,
  resolveEffectiveAccent,
  SVS_ACCENT,
} from "./ThemeProvider.tsx";
import {
  getThemePair,
  normalizeSvsThemeName,
  resolveShikiThemeName,
} from "./theme-loader.ts";

test("SVS themes use the SVS cyan accent while other themes keep the chosen accent", () => {
  assert.equal(isSvsTheme("svs"), true);
  assert.equal(isSvsTheme("svs-dark"), true);
  assert.equal(resolveEffectiveAccent("svs", "#ef4444"), SVS_ACCENT);
  assert.equal(resolveEffectiveAccent("svs-dark", "#ef4444"), SVS_ACCENT);
  assert.equal(resolveEffectiveAccent("houston", "#ef4444"), "#ef4444");
});

test("legacy Buzz selections migrate to the first-class SVS theme pair", () => {
  assert.equal(normalizeSvsThemeName("buzz"), "svs");
  assert.equal(normalizeSvsThemeName("buzz-dark"), "svs-dark");
  assert.equal(normalizeSvsThemeName("houston"), "houston");
  assert.equal(getThemePair("svs"), "svs-dark");
  assert.equal(resolveShikiThemeName("svs-dark"), "github-dark");
});

test("glass uses a light color tint instead of replaying the full opacity", () => {
  assert.equal(getGlassTintOpacity(30), 8);
  assert.equal(getGlassTintOpacity(50), 14);
  assert.equal(getGlassTintOpacity(90), 25);
});

test("glass keeps workspace panes legible while visibly translucent", () => {
  assert.equal(getGlassContentOpacity(30), 50);
  assert.equal(getGlassContentOpacity(50), 56);
  assert.equal(getGlassContentOpacity(90), 68);
});
