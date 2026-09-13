import type { ForumPost } from "@/shared/api/types";

/**
 * Orders a reader can put a forum in. Latest activity is the default: a thread
 * someone just answered or moved to a new status is the one worth reading, no
 * matter how old its first post is.
 */
export const FORUM_SORTS = [
  { value: "activity", label: "Latest activity" },
  { value: "newest", label: "Newest posts" },
  { value: "oldest", label: "Oldest posts" },
  { value: "replies", label: "Most replies" },
] as const;

export type ForumSort = (typeof FORUM_SORTS)[number]["value"];

export const DEFAULT_FORUM_SORT: ForumSort = "activity";

/** A status change is a reply, so it counts as activity like any comment. */
export function forumLastActivityAt(post: ForumPost): number {
  return Math.max(post.createdAt, post.threadSummary?.lastReplyAt ?? 0);
}

export function sortForumPosts(
  posts: ForumPost[],
  sort: ForumSort,
): ForumPost[] {
  const compare = (left: ForumPost, right: ForumPost): number => {
    switch (sort) {
      case "newest":
        return right.createdAt - left.createdAt;
      case "oldest":
        return left.createdAt - right.createdAt;
      case "replies":
        return (
          (right.threadSummary?.replyCount ?? 0) -
            (left.threadSummary?.replyCount ?? 0) ||
          forumLastActivityAt(right) - forumLastActivityAt(left)
        );
      default:
        return forumLastActivityAt(right) - forumLastActivityAt(left);
    }
  };
  // The event id breaks ties, so equal timestamps never swap rows on a poll.
  return [...posts].sort(
    (left, right) =>
      compare(left, right) || left.eventId.localeCompare(right.eventId),
  );
}
