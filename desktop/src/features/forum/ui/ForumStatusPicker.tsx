import { ChevronDown, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/cn";

import { useSetForumPostStatusMutation } from "../hooks";
import { describeForumStatus, FORUM_STATUSES } from "../lib/status";

/**
 * Say where this thread stands, from inside the thread.
 *
 * The change posts as an ordinary comment, so the thread keeps a record of who
 * moved it and when instead of a field quietly flipping. That record is the
 * point: a bug marked fixed with nothing explaining why is the state people
 * stop trusting first.
 */
export function ForumStatusPicker({
  channelId,
  rootEventId,
  status,
}: {
  channelId: string;
  rootEventId: string;
  status: string | null | undefined;
}) {
  const setStatus = useSetForumPostStatusMutation(channelId);
  const current = describeForumStatus(status);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium leading-4 transition-colors",
            current?.className ??
              "border-border bg-transparent text-muted-foreground hover:bg-accent",
            setStatus.isPending && "opacity-60",
          )}
          disabled={setStatus.isPending}
          type="button"
        >
          {setStatus.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          {current?.label ?? "Set status"}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FORUM_STATUSES.map((entry) => (
          <DropdownMenuItem
            key={entry.value}
            onClick={() =>
              setStatus.mutate({
                rootEventId,
                status: entry.value,
                note: `Status → ${entry.label}`,
              })
            }
          >
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
