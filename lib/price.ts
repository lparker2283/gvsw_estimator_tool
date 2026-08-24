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

3. This document is INTERNAL — read by the mason, never sent to a client. His own card says so. That does not license invention; it licenses labelling. A figure you can ground goes in with its basis named. A figure you cannot — a rental nobody has quoted — is null, with a note saying what it is and why there is no number yet. Never an unlabelled number.

3a. THE RANGE IS THE PRODUCT, not a committed price. He commits to a figure himself, later, in his own proposal. Your job is to hand him two ends and make the distance between them explainable.

   LOW:  bottom of every cited band · fewer-days assumption · contingent lines EXCLUDED · adjustment factors at their low percentage
   HIGH: top of every cited band · more-days assumption · contingent lines INCLUDED · adjustment factors at their high percentage

   \`swing\` names the two or three assumptions that actually differ between the columns. He must be able to narrow the range by answering a question. "Depends on conditions" is not a swing factor; "whether the risers are sound" is.

3b. The conditions row uses the card's OWN named adjustment_factors — difficult access, scaffolding above 12 ft, historic district, winter work — and says which, at what percent. Never a percentage of your own devising. Where none applies the row is null, not zero with an excuse.

3c. Do NOT add an overhead or profit percentage. The card carries no such figure. Inventing one either double-charges the client or guesses at his books.

4. Compute BOTH pricing methods and report the gap:
   - unit price, off the card's per-unit bands
   - day rate, using the card's mason hourly rate over the on-site day count
   Where the job is small in quantity but long in access, the unit method under-prices badly. Say so.

5. Any quantity you assumed rather than received goes in \`assumptions\` with what it drives. The assumption list is a deliverable.

6. Classify tax per line: repair/partial replacement is taxable; new installation/complete replacement is a capital improvement.

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
        required: ['project_name','model','duration','blockers','range','explanation','objections',
                   'scope','derivation','materials','totals','cross_check','assumptions','tax_lines'],
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
                          why:{ type:'string', description:'one or two sentences, the reason it is that and not the other' } } },

          duration:   { type:'object', required:['low_days','high_days','drivers'],
                        properties:{
                          low_days:{ type:'number' }, high_days:{ type:'number' },
                          drivers:{ type:'array', items:{type:'string'},
                            description:'what decides where in the range it lands, ≤ 10 words each. These are the things that, if answered, narrow it.' } } },

          /**
           * What stops this being a confident number. Not everything unknown —
           * only what actually blocks. An estimate with nine caveats is an
           * estimate nobody sends.
           */
          blockers:   { type:'array', description:'what must be settled before committing to a price; empty if nothing does',
                        items:{ type:'object', required:['item','why','resolves_by'],
                          properties:{
                            item:{ type:'string', description:'≤ 10 words' },
                            why:{ type:'string', description:'what it moves — a number, a method, a liability. ≤ 20 words' },
                            resolves_by:{ type:'string', description:'the concrete next action: one call, one measurement, one site visit' },
                            ask:{ type:'array', items:{type:'string'}, description:'what to ask, ≤ 8 words each' },
                            measure:{ type:'array', items:{type:'string'}, description:'what to measure first, ≤ 8 words each' } } } },

          /**
           * Two columns. Low is the bottom of every cited band, the fewer-days
           * assumption, contingent lines out, adjustment factors at their low
           * percentage. High is the top of each band, more days, contingent lines
           * in, factors at their high. `swing` names what actually flips between
           * them, because a range whose spread cannot be explained is a shrug.
           */
          range:      { type:'object', required:['low','high','swing'],
                        properties:{
                          low:  { type:'object', required:['labor','materials','equipment','conditions'],
                                  properties:{ labor:{type:'number'}, materials:{type:'number'},
                                    equipment:{type:['number','null']}, conditions:{type:['number','null']},
                                    conditions_basis:{type:'string', description:'which named card adjustment factor, and at what percent'} } },
                          high: { type:'object', required:['labor','materials','equipment','conditions'],
                                  properties:{ labor:{type:'number'}, materials:{type:'number'},
                                    equipment:{type:['number','null']}, conditions:{type:['number','null']},
                                    conditions_basis:{type:'string'} } },
                          equipment_note:{ type:'string', description:'required when either equipment figure is null: what it is and why there is no number yet' },
                          swing:{ type:'array', items:{type:'string'},
                            description:'the two or three assumptions that differ between the columns, ≤ 12 words each' } } },

          explanation:{ type:'string', description:'one or two sentences under the range, in plain words, that Dan could say out loud to a client' },

          scope_sentence:{ type:'string', description:'one or two sentences of plain scope language Dan can lift straight into his own proposal' },

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
                            response:{ type:'string', description:'the consequence, not the persuasion. ≤ 40 words' },
                            grounded_in:{ type:'string', description:'the rate card key, the integrity spec, or the quoted words from the memo this rests on' } } } },

          validity:   { type:'string', description:'how long the range holds and what would move it — name the volatile input for this job' },
          scope:      { type:'array', items:{type:'object', required:['task','description','unit','cost','contingent'],
                          properties:{ task:{type:'string'}, description:{type:'string'}, unit:{type:'string'},
                            cost:{type:['number','null']}, contingent:{type:'boolean'}, contingency_note:{type:'string'} } } },
          derivation: { type:'array', items:{type:'object', required:['line','card','range','qty','chosen','rationale'],
                          properties:{ line:{type:'string'}, card:{type:'string'}, range:{type:'string'},
                            qty:{type:'string'}, low:{type:['number','null']}, high:{type:['number','null']},
                            chosen:{type:['number','null']}, rationale:{type:'string'} } } },
          materials:  { type:'array', items:{type:'object', properties:{ material:{type:'string'}, spec:{type:'string'},
                            supplier:{type:'string'}, qty:{type:'string'}, unit:{type:'string'}, cost:{type:'number'} } } },
          onsite_days:{ type:'number', description:'working days on site, incl. setup and strike' },
          totals:     { type:'object', properties:{ labor:{type:'number'}, materials:{type:'number'},
                            subtotal_ex_access:{type:'number'}, equipment:{type:['number','null']},
                            total:{type:['number','null']}, tax_classification:{type:'string'}, tax_note:{type:'string'} } },
          cross_check:{ type:'object', required:['headline','method_a','method_b','gap','reading','recommendation'],
                        properties:{ headline:{type:'string', description:'the pricing decision in ≤ 10 words'},
                          method_a:{type:'object'}, method_b:{type:'object'},
                          gap:{type:'string'}, reading:{type:'string'}, recommendation:{type:'string'} } },
          assumptions:{ type:'array', items:{type:'object', required:['what','why_it_matters'],
                          properties:{ what:{type:'string'}, why_it_matters:{type:'string'} } } },
          tax_lines:  { type:'array', items:{type:'object', properties:{ line:{type:'string'},
                          cls:{type:'string'}, basis:{type:'string'} } } },
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

  for (const d of spec.derivation || []) {
    if (d.card && d.card.includes('.')) {
      const [cat, key] = d.card.split('.');
      if (!card.categories?.[cat]?.items?.[key]) problems.push(`derivation "${d.line}" cites missing card key ${d.card}`);
    }
    if (d.chosen != null && d.low != null && d.high != null && (d.chosen < d.low || d.chosen > d.high))
      problems.push(`derivation "${d.line}" chose ${d.chosen} outside ${d.low}-${d.high}`);
  }

  const scopeSum = (spec.scope || []).reduce((a: number, s: any) => a + (s.cost || 0), 0);
  if (spec.totals?.subtotal_ex_access != null && Math.abs(scopeSum - spec.totals.subtotal_ex_access) > 1)
    problems.push(`scope sums to ${scopeSum} but subtotal_ex_access is ${spec.totals.subtotal_ex_access}`);

  const matSum = (spec.materials || []).reduce((a: number, m: any) => a + (m.cost || 0), 0);
  if (spec.totals) {
    spec.totals.materials = matSum;
    spec.totals.labor = scopeSum - matSum;
    spec.totals.subtotal_ex_access = scopeSum;
  }

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
    const awaitingQuote = (spec.scope || []).some((s: any) => s.cost === null || s.cost === undefined);
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
