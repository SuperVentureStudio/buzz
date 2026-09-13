import { describeForumStatus } from "../lib/status";
import { cn } from "@/shared/lib/cn";

/** Nothing renders until someone has actually said where the thread stands. */
export function ForumStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const described = describeForumStatus(status);
  if (!described) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-2xs font-medium leading-4",
        described.className,
        className,
      )}
    >
      {described.label}
    </span>
  );
}
