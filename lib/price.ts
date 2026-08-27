/**
 * Pricing. Turns extraction + answers into a priced job spec.
 * Two methods are always computed and the disagreement is reported, never hidden.
 */
import Anthropic from '@anthropic-ai/sdk';
import { envSecret } from '@/lib/secrets';
import ratecard from '../data/ratecard.json';

// Built on first use: the SDK throws without a key, and Next imports this
// module while collecting page data during the build, where no key exists.
let _anthropic: Anthropic | null = null;
function anthropic() {
  // envSecret, not process.env: a key pasted with the next .env line attached
  // fails inside fetch, and the SDK reports that as a bare "Connection error."
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: envSecret('ANTHROPIC_API_KEY') });
  return _anthropic;
}

const SYSTEM = `You price masonry jobs for Genesee Valley Stone Works against the attached rate card.

RULES

1. Every priced line MUST cite a real rate card key (e.g. "stone.stone_unit_reset") and its exact band. If no card item fits, say "Not on rate card — judgment" and justify the figure. NEVER cite a key that does not exist in the card.

2. The committed figure must sit inside the cited band, and you must say why it lands where it does inside that band.

2a. Every scope line carries a low and a high, derived the same way the range columns are. Both are null ONLY where nobody has quoted the line and no card band covers it — an access rental with no call made. A line you can bound from the card is never null, and "I would rather not commit" is not a reason to leave one empty: the two ends are how this page declines to commit.

3. This document is INTERNAL — read by the mason, never sent to a client. His own card says so. That does not license invention; it licenses labelling. A figure you can ground goes in with its basis named. A figure you cannot — a rental nobody has quoted — is null, with a note saying what it is and why there is no number yet. Never an unlabelled number.

3a. THE RANGE IS THE PRODUCT, not a committed price. He commits to a figure himself, later, in his own proposal. Your job is to hand him two ends and make the distance between them explainable.

   LOW:  bottom of every cited band · fewer-days assumption · contingent lines EXCLUDED · adjustment factors at their low percentage
   HIGH: top of every cited band · more-days assumption · contingent lines INCLUDED · adjustment factors at their high percentage

   What differs between the columns belongs in \`open_questions\`, one row per unknown, never restated elsewhere. He must be able to narrow the range by answering a question: "depends on conditions" is not a question, "whether the risers are sound" is.

3b. The conditions row uses the card's OWN named adjustment_factors — difficult access, scaffolding above 12 ft, historic district, winter work — and says which, at what percent. Never a percentage of your own devising. Where none applies the row is null, not zero with an excuse.

3c. Do NOT add an overhead or profit percentage. The card carries no such figure. Inventing one either double-charges the client or guesses at his books.

5. Any quantity you assumed rather than received is an \`open_questions\` row: the question is what you could not answer, \`assumed\` is the figure you used anyway, and \`swing\` is what the real answer moves. Do not also list it as a duration driver, a range note or a finding — one unknown, one row. Six unknowns printed three ways is how this page got to four pages.

6. Tax: repair and partial replacement are taxable; new installation and complete replacement are capital improvements. Say what he does about it in one sentence in \`tax_action\` and nowhere else.

7. Rate card bands are all-in (labour + material) per its "Total Est." convention. Do not double count.

8. OBJECTIONS must be grounded. Every response cites what it stands on — a rate card key, one of the card's integrity_specs (Type N or NHL lime for pre-1930 masonry, hydraulic cement on water contact, the 48" Monroe County frost line), or quoted words from the memo. A fluent invention repeated to a client costs him the room. Three grounded objections beat six fluent ones; if you cannot ground it, leave it out.

9. Write the objection in the words a client would use — "why can't you just patch the crack" — and the response as the consequence, not the persuasion. He is not closing a sale on this page; he is remembering why he priced it that way.

10. NEVER describe a job you were not given. Access equipment, return site visits, day-rate billing, lead times — none of these are facts about a job unless this job's extraction contains them. If a sentence would read identically on a chimney and on a patio, it is filler; cut it.

LENGTH

This is read on a reMarkable, on a job site, by a mason who is not a words guy. Every word past the decision is a word in his way.

11. HEADLINE: at most 10 words, and it must be a decision — "Day rate. Not per square foot." A restatement of the situation is not a headline.

12. READING and RECOMMENDATION: two sentences each, ceiling. State the consequence — a number, a method, a liability. He already understands masonry; do not explain masonry to him.

13. SCOPE DESCRIPTIONS: one line. What the line covers, not why the line exists.

14. Anything you would have written as reassurance, delete. The document is structurally safe — nothing is committed, every gap is listed, and he can mark it up. Saying so again reads as anxiety.

Return ONLY the tool JSON.`;

export async function price(extraction: any, answers: Record<string, string>, priorCorrections = '') {
  const msg = await anthropic().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: SYSTEM,
    tools: [{
      name: 'priced_job',
      description: 'A fully derived job spec.',
      input_schema: {
        type: 'object',
        required: ['project_name','model','duration','open_questions','next_steps','range',
                   'objections','scope','derivation','totals','tax_action'],
        properties: {
          project_name:{ type:'string', description:'the job in at most eight words, as Dan would say it aloud' },

          /**
           * The five blocks Dan reads, in the order he reads them. This is not a
           * proposal and does not try to be one — he writes that himself, later,
           * and better. It is the smallest thing that gets him from a voice memo
           * to being able to quote with a straight face.
           */
          model:      { type:'object', required:['recommendation','why'],
                        description:'how to charge for this job, and why',
                        properties:{
                          recommendation:{ type:'string', description:'≤ 12 words, a decision: "Day rate — repair with unknowns"' },
                          why:{ type:'string', description:'one or two sentences in plain words, naming the actual work. "Pricing per unit would undercharge since much of the labour is carrying materials up and down." Not "under-recover", not "protects both parties" — say what happens on the job.' } } },

          duration:   { type:'object', required:['low_days','high_days'],
                        description:'days on site. What decides where it lands is in open_questions, not repeated here.',
                        properties:{ low_days:{ type:'number' }, high_days:{ type:'number' } } },

          /**
           * What stops this being a confident number. Not everything unknown —
           * only what actually blocks. An estimate with nine caveats is an
           * estimate nobody sends.
           */
          /**
           * One row per unknown, and the whole of what this page knows about it.
           *
           * These were three fields — `blockers`, `range.swing` and `assumptions`
           * — and on a real job they printed the same six facts three times in
           * three grammatical moods: the question, the two answers, and the
           * answer assumed. Twenty-one bullets carrying six facts, across three
           * sections a page apart, so nothing sat next to the thing that would
           * settle it.
           *
           * They are one thing. What nobody knows, what this estimate assumed
           * anyway, and what the answer moves.
           */
          open_questions: { type:'array',
                        description:'every unknown that moves the price, one row each. Never repeat a row in different words — if two questions resolve on the same measurement, they are one question.',
                        items:{ type:'object', required:['question','assumed','swing','critical'],
                          properties:{
                            question:{ type:'string', description:'what nobody knows yet, ≤ 10 words: "Crown condition — repair or rebuild"' },
                            assumed:{ type:'string', description:'what this estimate assumed in its absence, ≤ 15 words: "Cracked, not structurally failed"' },
                            swing:{ type:'string', description:'what the answer moves, in money where the card gives money, ≤ 15 words: "$280 repair vs $1,100 rebuild"' },
                            critical:{ type:'boolean', description:'true when a wrong guess here is four figures or a liability' } } } },

          /**
           * The errands, gathered across every blocker rather than repeated under
           * each one. Two blockers settled by the same roof visit are one trip,
           * and a list that says so is a list he can work from.
           */
          next_steps: { type:'array', items:{type:'string'},
                        description:'the actions that clear the blockers, consolidated — one bullet per trip or call, naming everything to do while there. "One roof visit: measure roof-to-cap on all four sides, photograph crown and flashing." Not one bullet per blocker.' },

          /**
           * Two columns. Low is the bottom of every cited band, the fewer-days
           * assumption, contingent lines out, adjustment factors at their low
           * percentage. High is the top of each band, more days, contingent lines
           * in, factors at their high. `swing` names what actually flips between
           * them, because a range whose spread cannot be explained is a shrug.
           */
          range:      { type:'object', required:['low','high'],
                        properties:{
                          low:  { type:'object', required:['labor','materials','equipment','conditions'],
                                  properties:{ labor:{type:'number'}, materials:{type:'number'},
                                    equipment:{type:['number','null']}, conditions:{type:['number','null']},
                                    conditions_basis:{type:'string', description:'which named card adjustment factor, and at what percent'} } },
                          high: { type:'object', required:['labor','materials','equipment','conditions'],
                                  properties:{ labor:{type:'number'}, materials:{type:'number'},
                                    equipment:{type:['number','null']}, conditions:{type:['number','null']},
                                    conditions_basis:{type:'string'} } },
                          equipment_note:{ type:'string', description:'required when either equipment figure is null: what it is and why there is no number yet, in one sentence' } } },

          scope_sentence:{ type:'string', description:'the job in plain words, two sentences at most, written so Dan can lift it straight into his own proposal. This is the only prose description of the work on the page.' },

          /**
           * The most useful block and the most dangerous. A fluent invention
           * repeated to a client costs him the room, so every note must name what
           * it stands on — a card band, an integrity spec, or his own words.
           */
          objections: { type:'array', maxItems: 4,
                        description:'what a client is likely to push back on, and what Dan can say. Three grounded beats six fluent. Omit any you cannot ground.',
                        items:{ type:'object', required:['objection','response','grounded_in'],
                          properties:{
                            objection:{ type:'string', description:'in the words a client would actually use, ≤ 15 words' },
                            response:{ type:'string', description:'two sentences: the consequence, and the number that settles it. ≤ 35 words. "Portland is too hard and spalls the face" is half an answer without "$32–52 a bag against $14–20".' },
                            grounded_in:{ type:'string', description:'the rate card key, the integrity spec, or the quoted words from the memo this rests on' } } } },

          validity:   { type:'string', description:'one sentence: how long it holds, and the single volatile input. Not a paragraph about scheduling.' },
          /**
           * Two ends per line, never one committed figure. The page leads with a
           * range and 3a tells you not to commit a price; a `cost` column asked
           * the same model for a single number anyway, so it returned null on
           * every line and the table printed NOT PRICED five times under a range
           * that read $1,820–$5,940. Same question, two shapes, one of them
           * unanswerable.
           */
          scope:      { type:'array', items:{type:'object', required:['task','description','unit','low','high','contingent'],
                          properties:{ task:{type:'string'}, description:{type:'string'}, unit:{type:'string'},
                            low:{type:['number','null'], description:'this line at the bottom of its cited band and the smaller quantity'},
                            high:{type:['number','null'], description:'this line at the top of its cited band and the larger quantity'},
                            contingent:{type:'boolean'}, contingency_note:{type:'string'} } } },
          derivation: { type:'array', items:{type:'object', required:['line','card','range','qty','chosen','rationale'],
                          properties:{ line:{type:'string'}, card:{type:'string'}, range:{type:'string'},
                            qty:{type:'string'}, low:{type:['number','null']}, high:{type:['number','null']},
                            chosen:{type:['number','null']}, rationale:{type:'string'} } } },
          totals:     { type:'object', properties:{ labor:{type:'number'}, materials:{type:'number'},
                            subtotal_ex_access:{type:'number'}, equipment:{type:['number','null']},
                            total:{type:['number','null']}, tax_classification:{type:'string'}, tax_note:{type:'string'} } },
          tax_action: { type:'string', description:'ONE sentence telling Dan what to do about tax — "Add sales tax to the whole invoice; every line here is a taxable repair." Where lines differ, say which are exempt and stop. Not a paragraph, and never a per-line table.' },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'priced_job' },
    messages: [{ role: 'user', content:
      `RATE CARD:\n${JSON.stringify(ratecard)}\n\n` +
      `EXTRACTION:\n${JSON.stringify(extraction)}\n\n` +
      `ANSWERS FROM DAN:\n${JSON.stringify(answers)}` +
      // What he already corrected by hand, on documents this tool produced. A
      // rate he has overridden twice is not a rate; it is the card drifting.
      (priorCorrections ? `\n\nWHAT DAN HAS CORRECTED BEFORE — treat these as authoritative over the card:\n${priorCorrections}` : '') }],
  });

  const spec: any = (msg.content.find((c: any) => c.type === 'tool_use') as any).input;
  return validate(spec);
}

/** A working day on site. The card quotes an hourly mason rate over 8-hour days. */
const HOURS_PER_DAY = 8;

/** Cheap deterministic guards. The model is good; arithmetic should not be trusted to it. */
export function validate(spec: any) {
  const problems: string[] = [];
  const card: any = ratecard;

  /**
   * Coerce every field that must be an array before anything reduces over it.
   *
   * `spec.scope || []` guards a null, not a wrong type: a tool call is a model
   * output, and on the first live run of the new schema `scope` came back as
   * something other than an array, so `(spec.scope || []).reduce` threw and
   * killed the whole submit — `price failed — (a.scope || []).reduce is not a
   * function`. The shape of a model response is never a given, and one bad field
   * must degrade to empty, and be recorded, not crash the job. A malformed array
   * is normalised to empty here and named on the review copy, so the tool comes
   * back saying what it could not read rather than dying mid-word.
   */
  for (const key of ['scope', 'derivation', 'materials', 'open_questions', 'next_steps', 'objections', 'tax_lines']) {
    if (spec[key] !== undefined && !Array.isArray(spec[key])) {
      problems.push(`${key} came back as ${typeof spec[key]}, not a list — dropped`);
      spec[key] = [];
    }
  }

  /**
   * A citation resolves against `categories.<cat>.items.<key>` OR against the
   * card's other top-level sections — quick_reference, adjustment_factors,
   * integrity_specs, tax. Only the first was checked, so every honest citation
   * of an hourly rate or an adjustment factor was reported as a missing key.
   * Two of those reached Dan's page, and the model had been right both times.
   */
  const cardHas = (cat: string, key: string) =>
    !!(card.categories?.[cat]?.items?.[key] ?? card?.[cat]?.[key]);

  for (const d of spec.derivation || []) {
    if (d.card && d.card.includes('.')) {
      const [cat, key] = d.card.split('.');
      if (!cardHas(cat, key)) problems.push(`derivation "${d.line}" cites missing card key ${d.card}`);
    }
    if (d.chosen != null && d.low != null && d.high != null && (d.chosen < d.low || d.chosen > d.high))
      problems.push(`derivation "${d.line}" chose ${d.chosen} outside ${d.low}-${d.high}`);
  }

  /**
   * The scope subtotal, both ends. `totals` is not rendered on the page or in the
   * email any more — the range is — so this exists to be summed once here rather
   * than trusted from the model, and the old cross-check against
   * `subtotal_ex_access` is gone with it. It compared a committed-price field to
   * a column of nulls and reported the difference as an arithmetic fault.
   */
  const sumEnd = (end: 'low' | 'high') =>
    (spec.scope || []).reduce((a: number, s: any) => a + (Number(s[end]) || 0), 0);

  if (spec.totals) {
    spec.totals.scope_low = sumEnd('low');
    spec.totals.scope_high = sumEnd('high');
  }

  for (const s2 of spec.scope || []) {
    if (s2.low != null && s2.high != null && s2.low > s2.high)
      problems.push(`scope line "${s2.task}" is inverted: low ${s2.low} exceeds high ${s2.high}`);
  }

  /**
   * The failure this shape exists to prevent, stated as a check.
   *
   * On GVSW-2026-0004 every line came back empty under a range reading
   * $1,820–$5,940, and the page printed NOT PRICED five times to a mason who was
   * meant to quote from it. Nothing said so; it took reading the derivation to
   * find that the numbers had been there all along. If the model ever drifts
   * back to answering the old question, this says so on the review copy instead
   * of leaving it to be discovered in the field.
   */
  const lines: any[] = spec.scope || [];
  const empty = lines.filter((s2: any) => s2.low == null && s2.high == null);
  if (lines.length && empty.length === lines.length)
    problems.push(`every scope line is unpriced (${lines.length} of ${lines.length}) — the range carries figures the lines do not`);

  /**
   * The range, summed here rather than by the model. Four rows, two columns, and
   * a null in the equipment row is a real state — "nobody has quoted this" — not
   * a zero. A column carrying a null totals what it can and says so; the old code
   * withheld the whole figure, which is how a document that was meant to unblock
   * him became the blocker.
   */
  const R = spec.range;
  if (R) {
    /**
     * A null row is two different states wearing one face. Equipment is null on
     * the chimney because nobody has quoted the lift, and null on a set of front
     * steps because the job needs no equipment. Conditions is null whenever none
     * of the card's named adjustment factors applies, which is a settled answer
     * and never a gap.
     *
     * Reading every null as "unpriced" is the same one-job assumption that used
     * to withhold the total: it makes a fully priced job hedge — "Range, so far",
     * "a row is still unpriced" — directly above a totals block that has already
     * committed to a number. So the column defers to the job. A figure is
     * outstanding only where a scope line is itself NOT PRICED, which is what the
     * extraction records when he has not called the rental yard.
     */
    const awaitingQuote = (spec.scope || []).some((s: any) => s.low == null && s.high == null);
    for (const col of ['low', 'high'] as const) {
      const c = R[col];
      if (!c) continue;
      const parts = [c.labor, c.materials, c.equipment, c.conditions];
      c.total = parts.reduce((a: number, n: any) => a + (Number(n) || 0), 0);
      c.partial = awaitingQuote && parts.some((n: any) => n === null || n === undefined);
    }
    if (R.low?.total != null && R.high?.total != null && R.low.total > R.high.total)
      problems.push(`range is inverted: low ${R.low.total} exceeds high ${R.high.total}`);
    if ((R.low?.partial || R.high?.partial) && !R.equipment_note)
      problems.push('a range row is unpriced but no equipment_note explains why');

    /**
     * The one line under the range.
     *
     * Deliberately just the arithmetic. He knows he undercharges — being told
     * again is nagging, and nagging a perfectionist about money buys avoidance,
     * not a higher number. So: what he is billing, over how long, per hour. No
     * comparison, no verdict, nothing for him to argue with.
     */
    const days = Number(spec.duration?.low_days ?? spec.onsite_days) || 0;
    const hours = days * HOURS_PER_DAY;
    if (hours > 0 && R.low?.labor != null) {
      spec.effective_rate = {
        labor: Math.round(R.low.labor),
        days,
        per_hour: Math.round(R.low.labor / hours),
      };
    }
  }

  spec._validation = problems;
  return spec;
}
