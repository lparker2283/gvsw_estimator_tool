import { brandFor, DEFAULT_BRAND } from '../brand';

export const money = (n: any) => (n === null || n === undefined) ? 'NOT PRICED'
  : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The documents render for the default tenant. Nothing carries a brand key this
 * far yet — that arrives with a `brand` column on the job — but the name and the
 * accent now come from the tokens rather than from here, so adding the column is
 * the only work left to make the PDFs multi-tenant too.
 */
const B = brandFor(DEFAULT_BRAND);

export const CO = {
  name: B.legalName,
  city: 'Rochester, NY',
  phone: '585-808-6247',
  email: 'dan@geneseevalleystoneworks.com',
  web: 'geneseevalleystoneworks.com',
  tagline: 'We take pride in every stone we set.',
  footer: 'Rochester, NY · Licensed & Insured · Serving the Greater Genesee Valley Region',
};

/** Type sizes lean large: these are read on a reMarkable, on e-ink, outdoors. */
export const CSS = `
  /**
   * One typeface, four sizes, four colours.
   *
   * This sheet had eleven type sizes, nine text colours and a second typeface
   * for the basis column, and it read as decoration around the numbers rather
   * than as a document. Hierarchy is weight and space here, not colour: the
   * accent appears twice (the rule under the title, and the section numbers)
   * and the warn colour only ever means "there is no figure here".
   *
   *   18pt  title
   *   12pt  lead sentence, range total
   *   10pt  body and table cells
   *   8.5pt labels, notes, the basis column, the footer
   *
   * Uppercase letterspacing is the one stylistic device, and it means the same
   * thing everywhere: this is a label, not prose.
   */
  @page { size: letter; }
  * { box-sizing: border-box; }

  body { font: 10pt/1.45 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #222; margin: 0; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 8px; padding-left: 20px; }
  li { margin-bottom: 4px; }

  h1 { font-size: 18pt; margin: 0 0 5px; letter-spacing: -.01em; }
  /* Client and town, under the title, at body size and weight: readable at
     arm's length on the tablet without being a second title. */
  .who { font-weight: 700; margin: 0 0 6px; }
  .rule { border-bottom: 2px solid ${B.accent}; margin-bottom: 9px; }
  .sub { font-size: 8.5pt; color: #6e6e6e; margin: 0 0 14px; }

  /* The one label style. Same size, same tracking, everywhere it appears. */
  .eyebrow, .sec h2, th, .minor, .crit {
    font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; font-weight: 700;
  }
  .eyebrow { color: ${B.accent}; margin-bottom: 7px; }
  .minor { color: #6e6e6e; margin: 12px 0 4px; }

  .sec { display: flex; align-items: baseline; gap: 8px; margin: 14px 0 6px; page-break-after: avoid; }
  .sec .n { color: ${B.accent}; font-weight: 700; }
  .sec h2 { color: #222; margin: 0; }

  .lead { font-size: 12pt; font-weight: 700; margin: 0 0 7px; }
  .first { font-weight: 700; }
  .note { font-size: 8.5pt; font-style: italic; color: #6e6e6e; margin-top: 5px; }
  .warn { color: #8a3b2a; }
  .crit { color: #8a3b2a; white-space: nowrap; }

  table { width: 100%; border-collapse: collapse; margin: 6px 0 3px; page-break-inside: auto; }
  /* Column labels are secondary to section headings, which share their size and
     tracking. Without this they read as the same order of thing. */
  th { color: #6e6e6e; text-align: left; padding: 0 9px 5px; border-bottom: 1.5px solid #222; }
  td { padding: 6px 9px; border-bottom: 1px solid #dcdcdc; vertical-align: top; line-height: 1.35; }
  tr { page-break-inside: avoid; }
  td.k { font-weight: 700; }
  td.r { text-align: right; font-weight: 700; white-space: nowrap; }
  td.num { font-weight: 700; color: ${B.accent}; text-align: center; }
  tr.strong td { background: #f4f3f0; }

  /* A scope line's status where it has no price: "not yet quoted", "if needed".
     A word, not a figure — the line table stopped being a second quote. */
  td.tag { font-weight: 400; color: #6e6e6e; font-style: italic; white-space: nowrap; }

  /* Secondary text inside a cell — the line description and the card citation.
     Same size as every other small thing on the page; the basis column used to
     be monospace, which is a second typeface for no reason a reader could name. */
  .sub-line, td.basis { font-size: 8.5pt; color: #6e6e6e; font-weight: 400; line-height: 1.3; }
  .sub-line { margin-top: 2px; }

  /* The two columns. The figure is the point, so the totals row is set larger. */
  table.range td.r { font-weight: 700; }
  table.range td.big { font-size: 12pt; }

  /* What he is billing, over how long, per hour. Set apart by weight and a rule,
     not by a tinted box with a coloured border — it is arithmetic, not a warning. */
  .rate { margin: 9px 0 4px; padding: 7px 0; border-top: 1px solid #dcdcdc;
          border-bottom: 1px solid #dcdcdc; font-weight: 700; }

  /* The plain-words summary of the job, quoted so it reads as something he could
     say out loud rather than as another finding. */
  .summary { font-style: italic; color: #444; padding-left: 11px;
             border-left: 2px solid #dcdcdc; margin: 4px 0 10px; }

  /* The closing block and the footer travel together. Left to itself the footer
     orphaned onto a third sheet carrying nothing but the address line. */
  .correct { margin-top: 10px; padding-top: 8px; border-top: 1px solid #dcdcdc;
             page-break-inside: avoid; }

  footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #dcdcdc;
           font-size: 8.5pt; color: #6e6e6e; text-align: center; }
`;

export const page = (title: string, body: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
