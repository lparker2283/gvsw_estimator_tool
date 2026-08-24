/**
 * The loop closing.
 *
 * Dan marks up the brief and emails it back. This reads the marks and files
 * them by kind, because "the estimate was wrong" is not a fact anyone can act
 * on and three different mistakes hide inside it:
 *
 *   quantity  -> the tool misheard the memo       -> fix extraction
 *   rate      -> the card is drifting             -> fix the rate card
 *   line      -> the tool mis-scoped the job      -> fix the completeness rules
 *
 * Collapsing those three into one number is how a feedback loop stops teaching
 * you anything. Keeping them apart is the entire point of the ledger.
 *
 * The brief numbers its scope lines for exactly this reason: a circle round a
 * numeral and a figure in the margin is unambiguous in a way that a circle round
 * a word never is.
 */
import Anthropic from '@anthropic-ai/sdk';
import { envSecret } from '@/lib/secrets';

let _anthropic: Anthropic | null = null;
function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: envSecret('ANTHROPIC_API_KEY') });
  return _anthropic;
}

export type Mark = {
  line_ref: string;
  kind: 'quantity' | 'rate' | 'line' | 'other';
  tool_value: string;
  dan_value: string;
  note: string;
  confidence: 'high' | 'medium' | 'low';
};

export type Reading = {
  verdict: 'approved' | 'corrected' | 'unreadable';
  marks: Mark[];
  summary: string;
};

const SYSTEM = `You read a marked-up masonry estimate and report what the mason changed.

The document was produced by an estimating tool and printed with numbered scope lines. The mason has annotated it by hand — on a tablet or on paper — and returned it. Your job is to report his marks, not to evaluate them. He is right; the tool is what is on trial.

RULES

1. Report ONLY marks you can actually see. An unmarked document is verdict "approved" with an empty marks array. Inventing a correction poisons the ledger and every estimate priced against it afterwards.

2. Attach every mark to the printed line number where there is one — line_ref "3". Where a mark sits on a section rather than a line, name the section: "totals", "assumptions", "unpriced".

3. Classify by what the mark tells the tool to fix, not by what it looks like:
   - quantity — a measurement, count, area or duration was wrong. The tool misheard the memo.
   - rate — the figure per unit was wrong while the quantity stood. The card is drifting.
   - line — a scope line was crossed out, or a new one written in. The tool mis-scoped the job.
   - other — anything else: a note, a question, a name, a date, an instruction.

4. tool_value is what was printed. dan_value is what he wrote. Where one of those does not exist — a line struck out, a line added — say so plainly: "struck out", "added".

5. Transcribe handwriting literally. Do not tidy an abbreviation into a sentence, and do not convert his units. If a numeral is genuinely ambiguous, record your best reading and set confidence to low.

6. Set confidence per mark. Low confidence is useful; a confident misreading is not.

7. summary: one sentence, at most 20 words, describing what he changed overall.

Return ONLY the tool JSON.`;

export async function readMarkup(pdf: Buffer, spec: any): Promise<Reading> {
  const printedLines = (spec?.scope || [])
    .map((s: any, i: number) => `${i + 1}. ${s.task} — ${s.cost === null ? 'NOT PRICED' : '$' + s.cost}`)
    .join('\n');

  const msg = await anthropic().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3000,
    system: SYSTEM,
    tools: [{
      name: 'markup_reading',
      description: 'What the mason changed on the returned document.',
      input_schema: {
        type: 'object',
        required: ['verdict', 'marks', 'summary'],
        properties: {
          verdict: { type: 'string', enum: ['approved', 'corrected', 'unreadable'] },
          summary: { type: 'string' },
          marks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['line_ref', 'kind', 'tool_value', 'dan_value', 'note', 'confidence'],
              properties: {
                line_ref:   { type: 'string' },
                kind:       { type: 'string', enum: ['quantity', 'rate', 'line', 'other'] },
                tool_value: { type: 'string' },
                dan_value:  { type: 'string' },
                note:       { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
            },
          },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'markup_reading' },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
        { type: 'text', text:
          `This is estimate ${spec?.proposal_no || '(unknown)'}.\n\n` +
          `WHAT THE TOOL PRINTED ON THE NUMBERED LINES:\n${printedLines || '(scope unavailable)'}\n\n` +
          `Report his marks.` },
      ] as any,
    }],
  });

  const block: any = msg.content.find((c: any) => c.type === 'tool_use');
  if (!block) return { verdict: 'unreadable', marks: [], summary: 'The model returned no reading.' };
  return block.input as Reading;
}

/**
 * The ledger, compacted for the next estimate.
 *
 * Rates first and deduplicated: a figure Dan has overridden more than once is
 * the strongest signal in here, and repeating the same override five times in
 * a prompt only crowds out the rest. Quantities are kept as examples of what
 * gets misheard rather than as instructions — the next job has its own numbers.
 */
export function digest(rows: any[], limit = 24): string {
  if (!rows?.length) return '';
  const seen = new Set<string>();
  const order = { rate: 0, line: 1, quantity: 2, other: 3 } as Record<string, number>;

  return rows
    .filter(r => (r.kind === 'rate' || r.kind === 'line' || r.kind === 'quantity'))
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))
    .filter(r => {
      const k = `${r.kind}|${(r.line_ref || '').toLowerCase()}|${(r.dan_value || '').toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map(r => `- ${r.kind}: "${r.tool_value}" → "${r.dan_value}"${r.note ? ` (${r.note})` : ''}`)
    .join('\n');
}
