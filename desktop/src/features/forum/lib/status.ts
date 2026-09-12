/**
 * Where the work in a thread stands.
 *
 * A forum root is a signed event and cannot be rewritten, so the state of the
 * thing it describes lives on the newest comment that declares one. The
 * vocabulary is small on purpose: a reader scanning a channel wants to know
 * whether a post still needs them, not to browse a taxonomy.
 */
export const FORUM_STATUSES = [
  { value: "open", label: "Open", tone: "sky" },
  { value: "investigating", label: "Investigating", tone: "amber" },
  { value: "needs-decision", label: "Needs you", tone: "violet" },
  { value: "blocked", label: "Blocked", tone: "rose" },
  { value: "fixed", label: "Fixed", tone: "emerald" },
  { value: "wont-fix", label: "Won't fix", tone: "slate" },
] as const;

export type ForumStatus = (typeof FORUM_STATUSES)[number];

const TONE_CLASSES: Record<ForumStatus["tone"], string> = {
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  slate: "border-border bg-muted text-muted-foreground",
};

/**
 * An agent can write any status it likes, so an unknown value is shown as
 * written rather than dropped — a label nobody planned for still tells the
 * reader more than a blank space.
 */
export function describeForumStatus(
  status: string | null | undefined,
): { label: string; className: string } | null {
  const value = status?.trim();
  if (!value) return null;
  const known = FORUM_STATUSES.find(
    (entry) => entry.value === value.toLowerCase(),
  );
  return {
    label: known?.label ?? value,
    className: TONE_CLASSES[known?.tone ?? "slate"],
  };
}
