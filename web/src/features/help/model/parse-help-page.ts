export interface HelpFigure {
  // The name of the files under media/, without scheme and extension.
  id: string;
  alt: string;
  caption: string;
}

export interface HelpStep {
  markdown: string;
  figure?: HelpFigure;
}

export type HelpBlock =
  | { type: "text"; markdown: string }
  | { type: "steps"; steps: HelpStep[]; video?: HelpFigure }
  | { type: "figure"; figure: HelpFigure }
  | { type: "term"; id: string; term: string; markdown: string }
  | { type: "pointer"; markdown: string };

export interface HelpSection {
  id: string;
  title: string;
  // The id was written after the heading, so it is the same in every language.
  written: boolean;
  blocks: HelpBlock[];
}

export interface HelpDocument {
  title: string;
  // The lead as plain text, for a list; leadMarkdown keeps its links for the page.
  lead: string;
  leadMarkdown: string;
  intro: HelpBlock[];
  sections: HelpSection[];
}

const HEADING = /^##\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/;
const IMAGE = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/;
const ITEM = /^\d+\.\s+/;
const TERM = /^\*\*([^*]+)\*\*:\s+/;
const POINTER = /^[^\s:]{2,16}:\s+(\[[^\]]+\]\([^)]+\)\.?)$/;
const VIDEO = ".video";

// A help page as the screens draw it (spec 2026-11-17-help-design, HP2 and HP3): the title, the
// lead, and sections of text, steps, figures, terms and a closing pointer.
export function parseHelpPage(text: string): HelpDocument {
  const [first = "", ...rest] = text.split("\n");
  const [lead = "", ...chunks] = splitChunks(rest);
  const intro: string[] = [];
  const sections: { heading: RegExpExecArray; chunks: string[] }[] = [];

  for (const chunk of chunks) {
    const heading = HEADING.exec(chunk);
    const open = sections.at(-1);

    if (heading !== null) sections.push({ heading, chunks: [] });
    else if (open === undefined) intro.push(chunk);
    else open.chunks.push(chunk);
  }

  return {
    title: first.replace(/^#\s+/, "").trim(),
    lead: plainText(lead),
    leadMarkdown: lead,
    intro: readBlocks(intro),
    sections: sections.map(({ heading, chunks: own }) => ({
      id: heading[2] ?? slug(heading[1] ?? ""),
      title: heading[1] ?? "",
      written: heading[2] !== undefined,
      blocks: readBlocks(own),
    })),
  };
}

// The anchor of a title: lower case, letters and digits of any script, words joined by a hyphen.
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

// Markdown where it is not drawn: a link keeps its words, emphasis and code lose their marks.
export function plainText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/\s*\n\s*/g, " ");
}

// The runs of lines between blank lines; a fenced block keeps its blank lines.
function splitChunks(lines: readonly string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let fenced = false;

  for (const line of lines) {
    if (line.startsWith("```")) fenced = !fenced;

    if (line.trim() === "" && !fenced) {
      if (current.length > 0) chunks.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) chunks.push(current.join("\n"));

  return chunks;
}

function readBlocks(chunks: readonly string[]): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let video: HelpFigure | undefined;

  chunks.forEach((chunk, index) => {
    const figure = readFigure(chunk);
    const term = TERM.exec(chunk);
    const pointer = index === chunks.length - 1 ? POINTER.exec(chunk) : null;
    const last = blocks.at(-1);

    if (figure?.id.endsWith(VIDEO) === true) {
      video = { ...figure, id: figure.id.slice(0, -VIDEO.length) };
    } else if (figure !== null) {
      blocks.push({ type: "figure", figure });
    } else if (ITEM.test(chunk)) {
      blocks.push({
        type: "steps",
        steps: readSteps(chunk),
        ...(video === undefined ? {} : { video }),
      });
      video = undefined;
    } else if (term?.[1] !== undefined) {
      blocks.push({
        type: "term",
        id: slug(term[1]),
        term: term[1],
        markdown: chunk.slice(term[0].length),
      });
    } else if (pointer?.[1] !== undefined) {
      blocks.push({ type: "pointer", markdown: pointer[1] });
    } else if (last?.type === "text") {
      last.markdown += `\n\n${chunk}`;
    } else {
      blocks.push({ type: "text", markdown: chunk });
    }
  });

  return blocks;
}

// A figure of the help is a step's own media with its caption, not an inline image: the page
// parser takes the figures out of the text and the help draws them.
function readFigure(line: string): HelpFigure | null {
  const image = IMAGE.exec(line.trim());
  if (image === null) return null;

  return { id: image[2] ?? "", alt: image[1] ?? "", caption: image[3] ?? "" };
}

// One step per numbered line; an indented image under it is its figure, any other indented line
// stays in its text.
function readSteps(chunk: string): HelpStep[] {
  const steps: HelpStep[] = [];

  for (const line of chunk.split("\n")) {
    const step = steps.at(-1);
    const figure = readFigure(line);

    if (ITEM.test(line) || step === undefined) {
      steps.push({ markdown: line.replace(ITEM, "") });
    } else if (figure !== null) {
      step.figure = figure;
    } else {
      step.markdown += `\n${line.trim()}`;
    }
  }

  return steps;
}
