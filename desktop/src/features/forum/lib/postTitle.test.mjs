import assert from "node:assert/strict";
import test from "node:test";

import { splitForumPostContent } from "./postTitle.ts";

test("promotes a short opening line to the title", () => {
  const { title, body } = splitForumPostContent(
    "🐛 Bugsnag intake is live.\n\nProduction errors from all 24 projects land here.",
  );

  assert.equal(title, "🐛 Bugsnag intake is live.");
  assert.equal(body, "Production errors from all 24 projects land here.");
});

test("strips heading, emphasis, link, and code decoration", () => {
  assert.equal(
    splitForumPostContent("## **Release checklist**\n\nbody").title,
    "Release checklist",
  );
  assert.equal(
    splitForumPostContent("[SUPA-1204](https://x.test) crashed").title,
    "SUPA-1204 crashed",
  );
  assert.equal(
    splitForumPostContent("`npm run dev` fails").title,
    "npm run dev fails",
  );
});

test("leaves a long opening paragraph in the body", () => {
  const paragraph = `${"word ".repeat(40)}end`;
  const { title, body } = splitForumPostContent(paragraph);

  assert.equal(title, null);
  assert.equal(body, paragraph);
});

test("truncates a long explicit heading", () => {
  const { title } = splitForumPostContent(`# ${"a".repeat(200)}`);

  assert.equal(title?.length, 121);
  assert.ok(title?.endsWith("…"));
});

test("does not promote a decoration-only line", () => {
  const content = "![screenshot](https://x.test/a.png)\n\nThe crash screen.";
  const { title, body } = splitForumPostContent(content);

  assert.equal(title, null);
  assert.equal(body, content);
});

test("a single-line post is all title and no body", () => {
  const { title, body } = splitForumPostContent("Deploy is green again.");

  assert.equal(title, "Deploy is green again.");
  assert.equal(body, "");
});

test("skips leading blank lines", () => {
  assert.equal(splitForumPostContent("\n\n  Hello\nmore").title, "Hello");
});

test("empty content yields no title", () => {
  assert.deepEqual(splitForumPostContent("   "), { title: null, body: "   " });
});
