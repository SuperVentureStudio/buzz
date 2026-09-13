import type { ForumPost } from "@/shared/api/types";

import { describeForumStatus, FORUM_STATUSES } from "./status";

/**
 * Narrowing a forum to the threads a reader wants. Both filters run over the
 * posts already loaded: a channel that keeps growing is read from the newest
 * end, and older pages join the search once the reader loads them.
 */

export const ALL_FORUM_STATUSES = "all";
export const NO_FORUM_STATUS = "none";

export type ForumStatusOption = { key: string; label: string; count: number };

/** An agent-written status nobody planned for still files under its own word. */
export function forumStatusKey(status: string | null | undefined): string {
  return status?.trim().toLowerCase() || NO_FORUM_STATUS;
}

/** One option per status present, in the vocabulary's order, unknowns after, unset last. */
export function forumStatusOptions(posts: ForumPost[]): ForumStatusOption[] {
  const options = new Map<string, ForumStatusOption>();
  for (const post of posts) {
    const status = post.threadSummary?.status;
    const key = forumStatusKey(status);
    const option = options.get(key) ?? {
      key,
      label:
        key === NO_FORUM_STATUS
          ? "No status"
          : (describeForumStatus(status)?.label ?? key),
      count: 0,
    };
    option.count += 1;
    options.set(key, option);
  }

  const rank = (key: string) => {
    if (key === NO_FORUM_STATUS) return FORUM_STATUSES.length + 1;
    const index = FORUM_STATUSES.findIndex((entry) => entry.value === key);
    return index === -1 ? FORUM_STATUSES.length : index;
  };
  return [...options.values()].sort(
    (left, right) =>
      rank(left.key) - rank(right.key) || left.key.localeCompare(right.key),
  );
}

/** Every word of the query must appear somewhere in the post, in any case. */
export function filterForumPosts(
  posts: ForumPost[],
  { query, status }: { query: string; status: string },
): ForumPost[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (
      status !== ALL_FORUM_STATUSES &&
      forumStatusKey(post.threadSummary?.status) !== status
    ) {
      return false;
    }
    const content = post.content.toLowerCase();
    return words.every((word) => content.includes(word));
  });
}
