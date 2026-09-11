import assert from "node:assert/strict";
import test from "node:test";

import { parseSvsUpdateMessage } from "./svsUpdateMessage.ts";

// The exact shape SVS sends (operator-notification-lane.ts digestMessage).
const update = [
  "**SVS update · 2026-09-11 evening**",
  "",
  "**Today**",
  "- Run weekly Finance OS review",
  "- Daily Log and Notes — 2026-09-11",
  "",
  "**Needs you**",
  "- BuildOnce is uninstrumented: missing brevo_list_ids",
  "- 2 more in SVS.",
  "",
  "**Waiting on your OK:** 3 approvals. Oldest: Q3 review gate (75d).",
  "",
  "**Went wrong**",
  "- Forge repo push failed",
  "",
  "**Heads-up:** 5 jobs flagged something · 575 parked items to look at again.",
  "",
  "**Weekly review due.** Score the Critical Number and Rocks.",
  "",
  "Reply to ask me about any of these.",
].join("\n");

test("reads the SVS update into sections, labelled lines and a footer", () => {
  assert.deepEqual(parseSvsUpdateMessage(update), {
    heading: "2026-09-11 evening",
    sections: [
      {
        title: "Today",
        items: [
          "Run weekly Finance OS review",
          "Daily Log and Notes — 2026-09-11",
        ],
        tone: "default",
      },
      {
        title: "Needs you",
        items: [
          "BuildOnce is uninstrumented: missing brevo_list_ids",
          "2 more in SVS.",
        ],
        tone: "default",
      },
      { title: "Went wrong", items: ["Forge repo push failed"], tone: "alert" },
    ],
    lines: [
      {
        label: "Waiting on your OK",
        text: "3 approvals. Oldest: Q3 review gate (75d).",
      },
      {
        label: "Heads-up",
        text: "5 jobs flagged something · 575 parked items to look at again.",
      },
      {
        label: "Weekly review due",
        text: "Score the Critical Number and Rocks.",
      },
    ],
    footer: "Reply to ask me about any of these.",
  });
});

test("keeps a section whose only line is guidance rather than a list", () => {
  const parsed = parseSvsUpdateMessage(
    "**SVS update · morning**\n\n**Today**\nReview today’s Who / What / When.",
  );
  assert.deepEqual(parsed?.sections, [
    {
      title: "Today",
      items: ["Review today’s Who / What / When."],
      tone: "default",
    },
  ]);
});

test("leaves every other message, and an unknown update shape, as Markdown", () => {
  assert.equal(
    parseSvsUpdateMessage("Hey Faisal. Want today’s rundown?"),
    null,
  );
  assert.equal(parseSvsUpdateMessage("**SVS update**\n\n**Today**\n- x"), null);
  assert.equal(
    parseSvsUpdateMessage("**SVS update · morning**\n\n| a | b |\n| - | - |"),
    null,
  );
});
