import { ArrowDownUp } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { FORUM_SORTS, type ForumSort } from "../lib/sortPosts";

/** Choose the order of the forum list; the current order names the button. */
export function ForumSortMenu({
  sort,
  onSortChange,
}: {
  sort: ForumSort;
  onSortChange: (sort: ForumSort) => void;
}) {
  const current =
    FORUM_SORTS.find((entry) => entry.value === sort) ?? FORUM_SORTS[0];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Sort: ${current.label}`}
          data-testid="forum-sort"
          size="sm"
          variant="outline"
        >
          <ArrowDownUp aria-hidden className="h-4 w-4" />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onSortChange(value as ForumSort)}
          value={sort}
        >
          {FORUM_SORTS.map((entry) => (
            <DropdownMenuRadioItem key={entry.value} value={entry.value}>
              {entry.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
