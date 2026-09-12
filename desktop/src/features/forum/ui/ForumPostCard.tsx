import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { UserProfilePopover } from "@/features/profile/ui/UserProfilePopover";
import { ProjectEntityFacepile } from "@/features/projects/ui/ProjectEntityListRow";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import type { ForumPost } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { resolveMentionProps } from "@/shared/lib/resolveMentionNames";
import { Markdown } from "@/shared/ui/markdown";
import { hasLinkPreviewSuppression } from "@/features/messages/lib/formatTimelineMessages";
import { parseImetaTags } from "@/shared/ui/markdown/parseImeta";

import { splitForumPostContent } from "../lib/postTitle";
import { formatRelativeTime } from "../lib/time";
import { ForumStatusBadge } from "./ForumStatusBadge";
import { DeleteActionMenu } from "./DeleteActionMenu";

const PREVIEW_LENGTH = 200;

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
  const avatarUrl = profiles?.[post.pubkey.toLowerCase()]?.avatarUrl ?? null;
  const authorIsAgent = profiles?.[post.pubkey.toLowerCase()]?.isAgent === true;
  const { mentionNames, mentionPubkeysByName } = resolveMentionProps(
    post.tags,
    profiles,
    post.content,
  );
  // Memoize the imeta map: `parseImetaTags` builds a fresh object each render,
  // and the `Markdown` memo compares `imetaByUrl` by reference. Without this,
  // the post's Markdown (and the FileCard <button> it renders) is rebuilt on
  // every ForumPostCard render, swapping the live DOM node. A click that lands
  // across one of those swaps splits mousedown/mouseup onto different nodes, so
  // the browser never fires `click` and a file download is silently dropped.
  const imetaByUrl = useMemo(() => parseImetaTags(post.tags), [post.tags]);
  const summary = post.threadSummary;
  const replyCount = summary?.replyCount ?? 0;
  const { title, body } = useMemo(
    () => splitForumPostContent(post.content),
    [post.content],
  );
  const previewContent =
    body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}...` : body;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Cannot use <button> because DeleteActionMenu renders a nested <button> via DropdownMenuTrigger, which is invalid HTML
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group w-full cursor-pointer rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-border/90 hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-6 text-foreground">
                {title}
              </h3>
              <ForumStatusBadge className="mt-0.5" status={summary?.status} />
            </div>
          ) : (
            <ForumStatusBadge className="mb-1.5" status={summary?.status} />
          )}
          {previewContent ? (
            <Markdown
              className={cn(
                "text-sm leading-6",
                title && "mt-1.5 text-muted-foreground",
              )}
              content={previewContent}
              messageId={post.eventId}
              linkPreviewsSuppressed={hasLinkPreviewSuppression(post.tags)}
              linkPreviewTags={post.tags}
              imetaByUrl={imetaByUrl}
              mentionNames={mentionNames}
              mentionPubkeysByName={mentionPubkeysByName}
            />
          ) : null}
        </div>

        {canDelete && onDelete ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: presentation wrapper only stops click propagation to parent card link
          <div
            className="-mr-1 -mt-1 shrink-0"
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

      <div className="mt-3.5 flex items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: presentation wrapper stops click propagation to parent card */}
        <div
          className="min-w-0"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <UserProfilePopover
            pubkey={post.pubkey}
            role={authorIsAgent ? "bot" : undefined}
          >
            <button
              className="flex min-w-0 items-center gap-1.5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              <UserAvatar
                accent={authorIsAgent}
                avatarUrl={avatarUrl}
                displayName={authorLabel}
                shape={authorIsAgent ? "squircle" : "circle"}
                size="xs"
              />
              <span className="truncate font-medium text-foreground/80 hover:underline">
                {authorLabel}
              </span>
            </button>
          </UserProfilePopover>
        </div>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span className="shrink-0">{formatRelativeTime(post.createdAt)}</span>

        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {replyCount > 0 && summary ? (
            <ProjectEntityFacepile
              participants={summary.participants}
              profiles={profiles}
            />
          ) : null}
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>
              {replyCount === 0
                ? "No replies"
                : `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
            </span>
            {summary?.lastReplyAt ? (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span>last {formatRelativeTime(summary.lastReplyAt)}</span>
              </>
            ) : null}
          </span>
        </span>
      </div>
    </div>
  );
}
