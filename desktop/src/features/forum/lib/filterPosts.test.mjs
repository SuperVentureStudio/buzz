import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_FORUM_STATUSES,
  filterForumPosts,
  forumStatusOptions,
  NO_FORUM_STATUS,
} from "./filterPosts.ts";

function post(eventId, content, status = null) {
  return {
    eventId,
    pubkey: "a".repeat(64),
    content,
    kind: 45001,
    createdAt: 1,
    channelId: "forum",
    tags: [],
    threadSummary: {
      replyCount: 0,
      descendantCount: 0,
      lastReplyAt: null,
      participants: [],
      status,
    },
  };
}

const posts = [
  post(
    "deadlock",
    "Bugsnag · WebMedic\n\nSQLSTATE[40001]: Deadlock found",
    "fixed",
  ),
  post(
    "null",
    "Bugsnag · D-Link website\n\nCall to get_queried_object() on null",
    "needs-decision",
  ),
  post(
    "array",
    "Bugsnag · D-Link website\n\nCall to array_to_object() on null",
    "Needs-Decision",
  ),
  post("agent", "Agent found something", "waiting on vendor"),
  post("quiet", "A post nobody has triaged"),
];

const ids = (list) => list.map((entry) => entry.eventId);

test("every search word must appear, in any case and any order", () => {
  assert.deepEqual(
    ids(
      filterForumPosts(posts, {
        query: "NULL d-link",
        status: ALL_FORUM_STATUSES,
      }),
    ),
    ["null", "array"],
  );
  assert.deepEqual(
    ids(
      filterForumPosts(posts, {
        query: "  deadlock  ",
        status: ALL_FORUM_STATUSES,
      }),
    ),
    ["deadlock"],
  );
});

test("a status filter combines with the search", () => {
  assert.deepEqual(
    ids(filterForumPosts(posts, { query: "", status: "needs-decision" })),
    ["null", "array"],
  );
  assert.deepEqual(
    ids(filterForumPosts(posts, { query: "array", status: "needs-decision" })),
    ["array"],
  );
  assert.deepEqual(
    ids(filterForumPosts(posts, { query: "", status: NO_FORUM_STATUS })),
    ["quiet"],
  );
});

test("status options count each status in vocabulary order, unknowns next, unset last", () => {
  assert.deepEqual(forumStatusOptions(posts), [
    { key: "needs-decision", label: "Needs you", count: 2 },
    { key: "fixed", label: "Fixed", count: 1 },
    { key: "waiting on vendor", label: "waiting on vendor", count: 1 },
    { key: NO_FORUM_STATUS, label: "No status", count: 1 },
  ]);
});
