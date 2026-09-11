import type { ReactNode } from "react";

import type { SvsUpdate } from "@/features/messages/lib/svsUpdateMessage";
import { cn } from "@/shared/lib/cn";

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Plain text with its `[label](http…)` links as anchors, opened like any message link. */
function InlineLinks({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    parts.push(
      <a
        className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        href={match[2]}
        key={start}
        rel="noreferrer"
        target="_blank"
      >
        {match[1]}
      </a>,
    );
    last = start + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/**
 * Maya's SVS update as a read-only card: what to do today and what needs
 * Faisal as short lists, everything counted as labelled lines, and the reply
 * hint as a footer. It has no actions; answering stays a normal reply.
 */
export function SvsUpdateCard({ update }: { update: SvsUpdate }) {
  return (
    <section
      aria-label={`SVS update, ${update.heading}`}
      className="mt-1 max-w-xl overflow-hidden rounded-lg border border-border/60 bg-card/80 text-message"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border/60 bg-primary/10 px-3 py-2">
        <h3 className="font-semibold text-foreground">SVS update</h3>
        <span className="text-xs text-muted-foreground">{update.heading}</span>
      </header>

      <div className="space-y-3 px-3 py-2.5">
        {update.sections.map((section) => (
          <div key={section.title}>
            <h4
              className={cn(
                "text-xs font-semibold",
                section.tone === "alert" ? "text-destructive" : "text-primary",
              )}
            >
              {section.title}
            </h4>
            <ul className="mt-1 space-y-0.5">
              {section.items.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[0.55em] size-1.5 shrink-0 rounded-full",
                      section.tone === "alert"
                        ? "bg-destructive"
                        : "bg-muted-foreground/60",
                    )}
                  />
                  <span>
                    <InlineLinks text={item} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {update.lines.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border/60 pt-2.5">
            {update.lines.map((line) => (
              <div className="contents" key={line.label}>
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd>
                  <InlineLinks text={line.text} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {update.footer && (
        <footer className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <InlineLinks text={update.footer} />
        </footer>
      )}
    </section>
  );
}
