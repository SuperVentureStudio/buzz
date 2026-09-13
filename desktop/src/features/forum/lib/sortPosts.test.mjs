import assert from "node:assert/strict";
import test from "node:test";

import { forumLastActivityAt, sortForumPosts } from "./sortPosts.ts";

function post(eventId, createdAt, summary = null) {
  return {
    eventId,
    pubkey: "a".repeat(64),
    content: eventId,
    kind: 45001,
    createdAt,
    channelId: "forum",
    tags: [],
    threadSummary: summary && {
      replyCount: summary.replyCount,
      descendantCount: summary.replyCount,
      lastReplyAt: summary.lastReplyAt,
      participants: [],
      status: null,
    },
  };
}

const posts = [
  post("old-busy", 100, { replyCount: 5, lastReplyAt: 900 }),
  post("new-quiet", 500),
  post("mid-recent", 300, { replyCount: 5, lastReplyAt: 700 }),
  post("no-replies-yet", 400, { replyCount: 0, lastReplyAt: null }),
];

const ids = (list) => list.map((entry) => entry.eventId);

test("latest activity puts a newly answered old thread above newer quiet posts", () => {
  assert.deepEqual(ids(sortForumPosts(posts, "activity")), [
    "old-busy",
    "mid-recent",
    "new-quiet",
    "no-replies-yet",
  ]);
  assert.equal(forumLastActivityAt(posts[1]), 500);
});

test("newest and oldest order by when the post was made", () => {
  assert.deepEqual(ids(sortForumPosts(posts, "newest")), [
    "new-quiet",
    "no-replies-yet",
    "mid-recent",
    "old-busy",
  ]);
  assert.deepEqual(ids(sortForumPosts(posts, "oldest")), [
    "old-busy",
    "mid-recent",
    "no-replies-yet",
    "new-quiet",
  ]);
});

test("most replies breaks a tie by latest activity and leaves the input alone", () => {
  const before = ids(posts);
  assert.deepEqual(ids(sortForumPosts(posts, "replies")), [
    "old-busy",
    "mid-recent",
    "new-quiet",
    "no-replies-yet",
  ]);
  assert.deepEqual(ids(posts), before);
});

test("equal timestamps keep a stable order", () => {
  const tied = [post("b", 10), post("a", 10)];
  assert.deepEqual(ids(sortForumPosts(tied, "activity")), ["a", "b"]);
});
