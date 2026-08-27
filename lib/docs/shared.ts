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
  @page { size: letter; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.45 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #2b2b2b; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 5px; color: #1a1a19; letter-spacing: -.01em; }
  .eyebrow { font-size: 8pt; letter-spacing: .2em; text-transform: uppercase; color: ${B.accent}; font-weight: 700; margin-bottom: 8px; }
  .rule { border-bottom: 2.5px solid ${B.accent}; margin-bottom: 10px; }
  .sub { font-size: 9pt; color: #807b72; margin: 0 0 14px; }
  .sec { display: flex; align-items: center; gap: 10px; margin: 12px 0 6px; page-break-after: avoid; }
  .sec .n { background: ${B.accent}; color: #fff; font-weight: 700; font-size: 10.5pt;
            width: 21px; height: 21px; display: flex; align-items: center; justify-content: center; border-radius: 3px; }
  .sec h2 { font-size: 10.5pt; letter-spacing: .16em; text-transform: uppercase; color: ${B.accent}; margin: 0; font-weight: 700; }
  .lead { font-size: 12pt; font-weight: 700; color: #1a1a19; margin: 0 0 7px; }
  p { margin: 0 0 8px; }
  .warn { color: #8a3b2a; }
  .muted { color: #807b72; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 3px; page-break-inside: auto; }
  th { background: ${B.accent}; color: #fff; text-align: left; padding: 5px 9px;
       font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; }
  td { padding: 6px 9px; border-bottom: 1px solid #ddd8ce; vertical-align: top; font-size: 9.5pt; line-height: 1.35; }
  tr { page-break-inside: avoid; }
  td.k { font-weight: 700; color: #1a1a19; }
  td.r { text-align: right; font-weight: 700; white-space: nowrap; }
  tr.strong td { background: #f0eee7; }
  .note { font-size: 8.5pt; font-style: italic; color: #807b72; margin-top: 5px; }
  .writein { border-bottom: 1px solid #d8d3c9; height: 26px; }
  /* The closing block and the footer travel together. Left to itself the footer
     orphaned onto a third sheet carrying nothing but the address line, which is
     how a two-page document became a three-page one. */
  .correct { margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd8ce;
             page-break-inside: avoid; }

  /* The line number a circled correction attaches to. Wide enough to read at
     arm's length on e-ink, quiet enough not to compete with the figure. */
  td.num { font-weight: 700; color: ${B.accent}; text-align: center; font-size: 10.5pt; }
  .sub-line { font-size: 8.5pt; color: #807b72; font-weight: 400; margin-top: 2px; line-height: 1.35; }
  td.basis { font-size: 8.5pt; color: #807b72; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .minor { font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: #807b72;
           font-weight: 700; margin: 16px 0 4px; }
  .first { font-weight: 700; color: #1a1a19; }

  /* A blocker where a wrong guess is four figures, not a detail he can carry. */
  .crit { font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: ${B.accent};
          font-weight: 700; white-space: nowrap; }

  /* The plain-words summary of the job, marked as a quotation so it reads as
     something he could say out loud rather than as another finding. */
  .summary { font-style: italic; color: #3d3a35; padding-left: 12px;
             border-left: 2px solid #ddd8ce; margin: 4px 0 10px; }

  /* The two columns. The figure is the point, so it is set larger than the prose
     around it and the totals row larger again. */
  table.range td.r { font-size: 11pt; }
  table.range td.big { font-size: 15pt; letter-spacing: -.02em; }

  /* The one line under the range: what he is billing, over how long, per hour.
     Set apart so it is not read as part of the table, and not styled as a
     warning — it is arithmetic, not a telling-off. */
  .rate { margin: 10px 0 3px; padding: 8px 12px; background: #f0eee7;
          border-left: 3px solid ${B.accent}; font-size: 11pt; font-weight: 700; color: #1a1a19; }

  /* The three figures he is actually looking for, before any prose. */
  .stats { display: flex; gap: 26px; margin: 4px 0 16px; }
  .stat { flex: 0 0 auto; }
  .statv { font-size: 19pt; font-weight: 700; color: #1a1a19; line-height: 1.1; letter-spacing: -.02em; }
  .statk { font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #807b72; margin-top: 3px; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  li { margin-bottom: 4px; }
  footer { page-break-before: avoid; margin-top: 14px; padding-top: 8px; border-top: 1px solid #ddd8ce;
           font-size: 8.5pt; color: #807b72; text-align: center; }
`;

export const page = (title: string, body: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
