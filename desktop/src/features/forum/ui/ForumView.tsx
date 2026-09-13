import {
  AlertCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import * as React from "react";

import { useAppShell } from "@/app/AppShellContext";
import { handleTimelineMentionCopy } from "@/features/messages/lib/timelineMentionCopy";
import { useProfileQuery, useUsersBatchQuery } from "@/features/profile/hooks";
import { mergeCurrentProfileIntoLookup } from "@/features/profile/lib/identity";
import { getMentionTagPubkey } from "@/shared/lib/resolveMentionNames";
import type { Channel } from "@/shared/api/types";
import { channelChrome } from "@/shared/layout/chromeLayout";
import { cn } from "@/shared/lib/cn";
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "@/shared/lib/safeStorage";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { VirtualizedList } from "@/shared/ui/VirtualizedList";

import {
  useCreateForumPostMutation,
  useCreateForumReplyMutation,
  useDeleteForumPostMutation,
  useDeleteForumReplyMutation,
  useForumPostsQuery,
  useForumThreadQuery,
} from "../hooks";
import {
  ALL_FORUM_STATUSES,
  filterForumPosts,
  forumStatusOptions,
  NO_FORUM_STATUS,
} from "../lib/filterPosts";
import {
  DEFAULT_FORUM_SORT,
  type ForumSort,
  sortForumPosts,
} from "../lib/sortPosts";
import { ForumComposer } from "./ForumComposer";
import { ForumPostCard } from "./ForumPostCard";
import { ForumSortMenu } from "./ForumSortMenu";
import { ForumThreadPanel } from "./ForumThreadPanel";

type ForumViewProps = {
  channel: Channel;
  currentPubkey?: string;
  onClosePost: () => void;
  onSelectPost: (postId: string) => void;
  onTargetReached?: (messageId: string) => void;
  selectedPostId: string | null;
  targetReplyId: string | null;
  targetSearchMessageId?: string;
  targetSearchQuery?: string;
};

/**
 * Posts are read, not skimmed sideways. Left to fill the pane, a line of body
 * text runs past 1,800px on a wide display, which is unreadable — so the
 * composer, the list and the load control share one centred reading column.
 */
const FORUM_COLUMN = "mx-auto w-full max-w-4xl";

/** Title drafts persist beside the body draft the composer already keeps. */
function titleDraftKey(channelId: string): string {
  return `buzz-forum-post-title:${channelId}`;
}

function canDelete(postPubkey: string, currentPubkey?: string): boolean {
  if (!currentPubkey) return false;
  // Author can always delete their own posts. Admin check would need
  // channel member role data — for now, author-only is sufficient.
  return postPubkey.toLowerCase() === currentPubkey.toLowerCase();
}

export function ForumView({
  channel,
  currentPubkey,
  onClosePost,
  onSelectPost,
  onTargetReached,
  selectedPostId,
  targetReplyId,
  targetSearchMessageId,
  targetSearchQuery,
}: ForumViewProps) {
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<string>(ALL_FORUM_STATUSES);
  const postsScrollRef = React.useRef<HTMLDivElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const { markThreadRead } = useAppShell();
  const profileQuery = useProfileQuery();
  const postsQuery = useForumPostsQuery(channel);
  const threadQuery = useForumThreadQuery(
    selectedPostId ? channel.id : null,
    selectedPostId,
  );
  const createPostMutation = useCreateForumPostMutation(channel);
  const createReplyMutation = useCreateForumReplyMutation(channel);
  const deletePostMutation = useDeleteForumPostMutation(channel);
  const deleteReplyMutation = useDeleteForumReplyMutation(
    channel,
    selectedPostId,
  );

  const posts = React.useMemo(
    () => (postsQuery.data ?? []).flatMap((page) => page.posts),
    [postsQuery.data],
  );

  const statusOptions = React.useMemo(() => forumStatusOptions(posts), [posts]);
  const hasStatuses = statusOptions.some(
    (option) => option.key !== NO_FORUM_STATUS,
  );
  // When the last post under a status moves on, its chip disappears. Keeping
  // the stale filter would show an empty list with no chip left to undo it.
  const activeStatus = statusOptions.some(
    (option) => option.key === statusFilter,
  )
    ? statusFilter
    : ALL_FORUM_STATUSES;
  const [sort, setSort] = React.useState<ForumSort>(DEFAULT_FORUM_SORT);
  const visiblePosts = React.useMemo(
    () =>
      sortForumPosts(
        filterForumPosts(posts, { query: searchQuery, status: activeStatus }),
        sort,
      ),
    [activeStatus, posts, searchQuery, sort],
  );

  // Collect all pubkeys from posts and thread for profile resolution.
  // Mentioned pubkeys (`p`/`mention` tags) must be included too: mention
  // chips resolve names from this same lookup, and a mentioned user who
  // never authored a post would otherwise render as a dead chip.
  const allPubkeys = React.useMemo(() => {
    const pubkeys = new Set<string>();
    const addMentionPubkeys = (tags?: string[][]) => {
      for (const tag of tags ?? []) {
        const pubkey = getMentionTagPubkey(tag);
        if (pubkey) {
          pubkeys.add(pubkey);
        }
      }
    };
    for (const post of posts) {
      pubkeys.add(post.pubkey);
      addMentionPubkeys(post.tags);
      if (post.threadSummary?.participants) {
        for (const pk of post.threadSummary.participants) {
          pubkeys.add(pk);
        }
      }
    }
    if (threadQuery.data) {
      pubkeys.add(threadQuery.data.post.pubkey);
      addMentionPubkeys(threadQuery.data.post.tags);
      for (const reply of threadQuery.data.replies) {
        pubkeys.add(reply.pubkey);
        addMentionPubkeys(reply.tags);
      }
    }
    return [...pubkeys];
  }, [posts, threadQuery.data]);

  const profilesQuery = useUsersBatchQuery(allPubkeys, {
    enabled: allPubkeys.length > 0,
  });
  const effectiveCurrentPubkey = currentPubkey ?? profileQuery.data?.pubkey;
  const profiles = React.useMemo(
    () =>
      mergeCurrentProfileIntoLookup(
        profilesQuery.data?.profiles,
        profileQuery.data,
      ),
    [profileQuery.data, profilesQuery.data?.profiles],
  );

  const previousChannelIdRef = React.useRef(channel.id);
  React.useEffect(() => {
    if (previousChannelIdRef.current === channel.id) {
      return;
    }

    previousChannelIdRef.current = channel.id;
    setIsComposerOpen(false);
    setTitle("");
    setSearchQuery("");
    setStatusFilter(ALL_FORUM_STATUSES);
  }, [channel.id]);

  // Reading a thread is the only thing that clears its replies. The channel
  // marker covers posts, not replies, so without this an answered ticket stays
  // bold and dotted in the sidebar forever.
  const openThread = selectedPostId ? threadQuery.data : undefined;
  React.useEffect(() => {
    if (!selectedPostId || !openThread) return;
    const newestSeen = openThread.replies.reduce(
      (latest, reply) => Math.max(latest, reply.createdAt),
      openThread.post.createdAt,
    );
    markThreadRead(selectedPostId, newestSeen);
  }, [markThreadRead, openThread, selectedPostId]);

  React.useEffect(() => {
    if (!isComposerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isComposerOpen]);

  const openComposer = React.useCallback(() => {
    setTitle(getStorageItem(titleDraftKey(channel.id)) ?? "");
    setIsComposerOpen(true);
  }, [channel.id]);

  const closeComposer = React.useCallback(
    (options?: { keepDraft?: boolean }) => {
      if (options?.keepDraft) {
        // The body draft survives a cancel, so the title must too.
        if (title.trim()) {
          setStorageItem(titleDraftKey(channel.id), title);
        } else {
          removeStorageItem(titleDraftKey(channel.id));
        }
      } else {
        removeStorageItem(titleDraftKey(channel.id));
        setTitle("");
      }
      setIsComposerOpen(false);
    },
    [channel.id, title],
  );

  const clearFilters = React.useCallback(() => {
    setSearchQuery("");
    setStatusFilter(ALL_FORUM_STATUSES);
  }, []);

  if (selectedPostId) {
    const threadPost = threadQuery.data?.post;
    const canDeleteExpandedPost = threadPost
      ? canDelete(threadPost.pubkey, effectiveCurrentPubkey)
      : false;

    return (
      <ForumThreadPanel
        key={`${channel.id}:${selectedPostId}`}
        postId={selectedPostId}
        canDeletePost={canDeleteExpandedPost}
        currentPubkey={effectiveCurrentPubkey}
        isDeletingPost={deletePostMutation.isPending}
        isLoading={threadQuery.isLoading}
        loadError={threadQuery.isError ? threadQuery.error : null}
        onRetry={() => void threadQuery.refetch()}
        isSendingReply={createReplyMutation.isPending}
        onBack={onClosePost}
        onDeletePost={(eventId) => {
          deletePostMutation.mutate({ eventId }, { onSuccess: onClosePost });
        }}
        onDeleteReply={(eventId) => {
          deleteReplyMutation.mutate({ eventId });
        }}
        channelId={channel.id}
        onReply={(content, mentionPubkeys, mediaTags) =>
          createReplyMutation.mutateAsync({
            content,
            parentEventId: selectedPostId,
            mentionPubkeys,
            mediaTags,
          })
        }
        onTargetReached={onTargetReached}
        profiles={profiles}
        targetEventId={targetReplyId}
        targetSearchMessageId={targetSearchMessageId}
        targetSearchQuery={targetSearchQuery}
        thread={threadQuery.data}
      />
    );
  }

  const postingBlockedReason = channel.archivedAt
    ? "This forum is archived."
    : !channel.isMember
      ? "Join this forum to create posts."
      : null;

  return (
    <div className={cn("flex h-full flex-col", channelChrome.contentPadding)}>
      <div className="border-b border-border/60 p-4">
        <div className={cn(FORUM_COLUMN, "space-y-3")}>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search posts"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-lg border border-border/70 bg-background py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="forum-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape" || !searchQuery) return;
                  event.preventDefault();
                  setSearchQuery("");
                }}
                placeholder="Search posts"
                spellCheck={false}
                type="text"
                value={searchQuery}
              />
            </div>
            {posts.length > 1 ? (
              <ForumSortMenu onSortChange={setSort} sort={sort} />
            ) : null}
            <Button
              aria-label="Refresh posts"
              data-testid="forum-refresh"
              disabled={postsQuery.isFetching}
              onClick={() => void postsQuery.refetch()}
              size="icon"
              title="Refresh"
              variant="ghost"
            >
              <RefreshCw
                aria-hidden
                className={cn(
                  "h-4 w-4",
                  postsQuery.isFetching && "animate-spin",
                )}
              />
            </Button>
            {postingBlockedReason ? (
              <p className="shrink-0 text-xs text-muted-foreground">
                {postingBlockedReason}
              </p>
            ) : isComposerOpen ? null : (
              <Button
                data-testid="forum-new-post"
                onClick={openComposer}
                size="sm"
              >
                <Plus aria-hidden className="h-4 w-4" />
                New post
              </Button>
            )}
          </div>

          {hasStatuses ? (
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Filter by status</legend>
              {[
                {
                  key: ALL_FORUM_STATUSES,
                  label: "All",
                  count: posts.length,
                },
                ...statusOptions,
              ].map((option) => {
                const selected = activeStatus === option.key;
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                    key={option.key}
                    onClick={() =>
                      setStatusFilter(
                        selected ? ALL_FORUM_STATUSES : option.key,
                      )
                    }
                    type="button"
                  >
                    {option.label}
                    <span className="tabular-nums opacity-70">
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          ) : null}

          {isComposerOpen ? (
            <ForumComposer
              autocompleteBelow
              channelId={channel.id}
              channelType="forum"
              draftKey={`forum:${channel.id}`}
              header={
                <input
                  aria-label="Post title"
                  className="w-full min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-hidden placeholder:font-normal placeholder:text-muted-foreground"
                  data-testid="forum-post-title"
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter in a bare input submits the surrounding form, which
                    // would post a title with no body. Move to the editor instead.
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    event.currentTarget
                      .closest("form")
                      ?.querySelector<HTMLElement>('[contenteditable="true"]')
                      ?.focus();
                  }}
                  placeholder="Title"
                  ref={titleInputRef}
                  value={title}
                />
              }
              isSending={createPostMutation.isPending}
              onCancel={() => closeComposer({ keepDraft: true })}
              onSubmit={async (content, mentionPubkeys, mediaTags) => {
                const headline = title.trim();
                await createPostMutation.mutateAsync({
                  content: headline ? `${headline}\n\n${content}` : content,
                  mentionPubkeys,
                  mediaTags,
                });
                closeComposer();
              }}
              placeholder="Write your post..."
              profiles={profiles}
            />
          ) : null}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-restoration-id={`forum-list:${channel.id}`}
        onCopy={handleTimelineMentionCopy}
        ref={postsScrollRef}
      >
        {postsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : postsQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground/70">
                Could not load posts
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {postsQuery.error instanceof Error
                  ? postsQuery.error.message
                  : "The forum did not respond."}
              </p>
            </div>
            <Button
              disabled={postsQuery.isFetching}
              onClick={() => void postsQuery.refetch()}
              size="sm"
              variant="outline"
            >
              {postsQuery.isFetching ? "Retrying..." : "Try again"}
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground/70">
                No posts yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start a discussion by creating the first post.
              </p>
            </div>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground/70">
                No posts match
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {postsQuery.hasNextPage
                  ? "Only loaded posts are searched. Load older posts to look further back."
                  : "Try another word or status."}
              </p>
            </div>
            <Button onClick={clearFilters} size="sm" variant="outline">
              Clear filters
            </Button>
          </div>
        ) : (
          // Padding lives on this wrapper, not on the virtualizer's spacer:
          // the rows are absolutely positioned, so they ignore the spacer's
          // own padding and would sit flush against the composer's divider.
          <div className="px-4 pt-4">
            <VirtualizedList
              estimateSize={72}
              getItemKey={(post) => post.eventId}
              innerClassName={FORUM_COLUMN}
              items={visiblePosts}
              renderItem={(post) => (
                <div className="pb-2">
                  <ForumPostCard
                    canDelete={canDelete(post.pubkey, effectiveCurrentPubkey)}
                    currentPubkey={effectiveCurrentPubkey}
                    isActive={selectedPostId === post.eventId}
                    isDeleting={
                      deletePostMutation.isPending &&
                      deletePostMutation.variables?.eventId === post.eventId
                    }
                    onClick={() => onSelectPost(post.eventId)}
                    onDelete={(eventId) => {
                      deletePostMutation.mutate({ eventId });
                    }}
                    post={post}
                    profiles={profiles}
                  />
                </div>
              )}
              scrollRef={postsScrollRef}
            />
          </div>
        )}

        {posts.length > 0 && postsQuery.hasNextPage ? (
          <div className={cn(FORUM_COLUMN, "flex justify-center px-4 pb-6")}>
            <Button
              disabled={postsQuery.isFetchingNextPage}
              onClick={() => void postsQuery.fetchNextPage()}
              size="sm"
              variant="outline"
            >
              {postsQuery.isFetchingNextPage
                ? "Loading older posts..."
                : "Load older posts"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
