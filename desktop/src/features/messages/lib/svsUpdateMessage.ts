/**
 * Maya's twice-daily SVS update, read back from its Markdown so the timeline
 * can show it as a card. The sender (SVS `operator-notification-lane.ts`)
 * writes a bold `**SVS update · <heading>**` first line, then blocks separated
 * by blank lines: a bold title over `- ` items, a single `**Label:** text`
 * line, or a plain footer. Anything else returns null and the message renders
 * as ordinary Markdown, so a format change degrades to text, never to a
 * broken card.
 */
export type SvsUpdateSection = {
  title: string;
  items: string[];
  tone: "default" | "alert";
};

export type SvsUpdateLine = { label: string; text: string };

export type SvsUpdate = {
  heading: string;
  sections: SvsUpdateSection[];
  lines: SvsUpdateLine[];
  footer: string | null;
};

const HEADER = /^\*\*SVS update · (.+)\*\*$/;
const TITLE = /^\*\*([^*]+)\*\*$/;
const LABELLED = /^\*\*([^*]+?)[:.]\*\*\s+(.+)$/;
const ALERT_SECTIONS = new Set(["Went wrong"]);

export function parseSvsUpdateMessage(content: string): SvsUpdate | null {
  const blocks = content
    .trim()
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((block) => block.length > 0);
  const header = blocks[0]?.length === 1 ? HEADER.exec(blocks[0][0]) : null;
  if (!header) return null;

  const update: SvsUpdate = {
    heading: header[1],
    sections: [],
    lines: [],
    footer: null,
  };
  for (const block of blocks.slice(1)) {
    const title = TITLE.exec(block[0]);
    if (title && block.length > 1) {
      update.sections.push({
        title: title[1],
        items: block.slice(1).map((line) => line.replace(/^- /, "")),
        tone: ALERT_SECTIONS.has(title[1]) ? "alert" : "default",
      });
      continue;
    }
    const labelled = block.length === 1 ? LABELLED.exec(block[0]) : null;
    if (labelled) {
      update.lines.push({ label: labelled[1], text: labelled[2] });
      continue;
    }
    if (block.length === 1 && !block[0].startsWith("**") && !update.footer) {
      update.footer = block[0];
      continue;
    }
    return null;
  }
  return update;
}
