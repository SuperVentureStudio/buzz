import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { listRowDescription } from "@/features/projects/lib/projectsViewHelpers";
import type { ForumPost } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";

import { splitForumPostContent } from "../lib/postTitle";
import { formatRelativeTime } from "../lib/time";
import { DeleteActionMenu } from "./DeleteActionMenu";
import { ForumStatusBadge } from "./ForumStatusBadge";

type ForumPostCardProps = {
  post: ForumPost;
  currentPubkey?: string;
  profiles?: UserProfileLookup;
  isActive?: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
  onClick: (post: ForumPost) => void;
  onDelete?: (eventId: string) => void;
};

/**
 * One scannable row per thread. A channel of bug reports is read to find the
 * thread that needs you, so the list shows only what tells threads apart —
 * title, status, a one-line preview and recent activity. The full body, its
 * attachments and its mentions render once the thread is open.
 */
export function ForumPostCard({
  post,
  currentPubkey,
  profiles,
  isActive,
  canDelete,
  isDeleting,
  onClick,
  onDelete,
}: ForumPostCardProps) {
  const authorLabel = resolveUserLabel({
    pubkey: post.pubkey,
    currentPubkey,
    profiles,
    preferResolvedSelfLabel: true,
  });
  const summary = post.threadSummary;
  const replyCount = summary?.replyCount ?? 0;
  const lastActivityAt = summary?.lastReplyAt ?? post.createdAt;
  const { heading, preview } = useMemo(() => {
    const { title, body } = splitForumPostContent(post.content);
    const text = listRowDescription(body, title ?? undefined) ?? "";
    // Without a title, the body's opening words stand in for one.
    return title
      ? { heading: title, preview: text }
      : { heading: text || "Untitled post", preview: "" };
  }, [post.content]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: Cannot use <button> because DeleteActionMenu renders a nested <button> via DropdownMenuTrigger, which is invalid HTML
    <div
      role="button"
      tabIndex={0}
      data-testid="forum-post-row"
      className={cn(
        "group flex w-full cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5 text-left transition-colors hover:border-border/90 hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "border-primary/40 bg-accent/60",
        isDeleting && "pointer-events-none opacity-50",
      )}
      onClick={() => onClick(post)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(post);
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-6 text-foreground">
            {heading}
          </h3>
          <ForumStatusBadge status={summary?.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <p className="min-w-0 flex-1 truncate">
            <span className="font-medium text-foreground/70">
              {authorLabel}
            </span>
            {preview ? <span> · {preview}</span> : null}
          </p>
          <span className="flex shrink-0 items-center gap-1">
            <MessageSquare aria-hidden className="h-3.5 w-3.5" />
            <span className="tabular-nums">{replyCount}</span>
            <span className="sr-only">
              {replyCount === 1 ? "reply" : "replies"}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">
            {formatRelativeTime(lastActivityAt)}
          </span>
        </div>
      </div>

      {canDelete && onDelete ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: presentation wrapper only stops click propagation to parent card link
        <div
          className="-mr-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <DeleteActionMenu
            label="post"
            onConfirm={() => onDelete(post.eventId)}
          />
        </div>
      ) : null}
    </div>
  );
}
