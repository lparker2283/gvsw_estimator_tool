/**
 * One generation, two renderings.
 *
 * Dan reads the highlights in the truck on his phone and marks up the PDF at
 * the kitchen table later. If those two are generated separately they drift,
 * and then his pencil lands on a claim the email never made. So the content is
 * decided once, here, as data — and the email and the document each render the
 * same structure in the way their medium wants.
 *
 * Nothing in this file writes prose. If a sentence appears in the output it came
 * from the pricing call, which is where the length rules live.
 */

export type Money = number | null;

export type Column = {
  labor: Money;
  materials: Money;
  equipment: Money;
  conditions: Money;
  conditions_basis?: string;
  total?: number;
  partial?: boolean;
};

export type Highlights = {
  projectName: string;
  proposalNo: string;
  dateIssued?: string;

  model: { recommendation: string; why: string } | null;
  duration: { low_days: number; high_days: number; drivers: string[] } | null;
  blockers: { item: string; why: string; resolves_by: string; ask?: string[]; measure?: string[] }[];
  range: { low: Column; high: Column; swing: string[]; equipment_note?: string } | null;
  effectiveRate: { labor: number; days: number; per_hour: number } | null;
  explanation: string;
  scopeSentence: string;
  objections: { objection: string; response: string; grounded_in: string }[];
  validity: string;
};

export function highlights(spec: any): Highlights {
  return {
    projectName: spec.project_name || 'Estimate',
    proposalNo: spec.proposal_no || '',
    dateIssued: spec.date_issued,

    model: spec.model?.recommendation ? spec.model : null,
    duration: spec.duration?.low_days != null ? spec.duration : null,
    blockers: spec.blockers || [],
    range: spec.range?.low ? spec.range : null,
    effectiveRate: spec.effective_rate || null,
    explanation: spec.explanation || '',
    scopeSentence: spec.scope_sentence || '',
    objections: spec.objections || [],
    validity: spec.validity || '',
  };
}

/** "6–9 days" — and just "6 days" when the two ends agree, because a range of one is not a range. */
export function daySpan(d: { low_days: number; high_days: number } | null): string {
  if (!d) return '';
  return d.low_days === d.high_days ? `${d.low_days} days` : `${d.low_days}–${d.high_days} days`;
}

/**
 * The four rows, in the order they are read.
 *
 * Equipment is its own row and never folded into overhead: it is job-specific
 * and close to pass-through, it is taxable when billed on in NY, and merging it
 * with a standing percentage would hide whether a thin job was thin because of
 * the rental or because of the quote.
 *
 * The fourth row is conditions, not overhead. Dan's card carries named
 * adjustment factors — difficult access, scaffolding, historic, winter — and
 * carries no overhead figure at all. A row is either traceable to his card or it
 * is not on the page.
 */
export const ROWS: { key: keyof Column; label: string }[] = [
  { key: 'labor', label: 'Labour' },
  { key: 'materials', label: 'Materials' },
  { key: 'equipment', label: 'Equipment & access' },
  { key: 'conditions', label: 'Conditions' },
];

export const dollars = (n: Money): string =>
  n === null || n === undefined
    ? '—'
    : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

/** The sentence under the range. Arithmetic only — no comparison, no verdict. */
export function effectiveRateLine(e: Highlights['effectiveRate']): string {
  if (!e) return '';
  return `At the low column you're billing ${dollars(e.labor)} of labour across ${e.days} day${e.days === 1 ? '' : 's'} — $${e.per_hour} an hour.`;
}
