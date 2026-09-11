import assert from "node:assert/strict";
import test from "node:test";

import { resolveEffectiveAccent, SVS_ACCENT } from "./ThemeProvider.tsx";

test("SVS themes use the SVS cyan accent while other themes keep the chosen accent", () => {
  assert.equal(resolveEffectiveAccent("buzz", "#ef4444"), SVS_ACCENT);
  assert.equal(resolveEffectiveAccent("buzz-dark", "#ef4444"), SVS_ACCENT);
  assert.equal(resolveEffectiveAccent("houston", "#ef4444"), "#ef4444");
});
