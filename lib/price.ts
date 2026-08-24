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

3. Equipment the mason has not had quoted is NOT PRICED. Return null for its cost and null for the project total. A total resting on an invented rental figure is a number the client holds him to.

4. Compute BOTH pricing methods and report the gap:
   - unit price, off the card's per-unit bands
   - day rate, using the card's mason hourly rate over the on-site day count
   Where the job is small in quantity but long in access, the unit method under-prices badly. Say so.

5. Any quantity you assumed rather than received goes in \`assumptions\` with what it drives. The assumption list is a deliverable.

6. Classify tax per line: repair/partial replacement is taxable; new installation/complete replacement is a capital improvement.

7. Rate card bands are all-in (labour + material) per its "Total Est." convention. Do not double count.

8. NEVER describe a job you were not given. Access equipment, return site visits, day-rate billing, lead times — none of these are facts about a job unless this job's extraction contains them. If a sentence would read identically on a chimney and on a patio, it is filler; cut it.

LENGTH

This is read on a reMarkable, on a job site, by a mason who is not a words guy. Every word past the decision is a word in his way.

9. HEADLINE: at most 10 words, and it must be a decision — "Day rate. Not per square foot." A restatement of the situation is not a headline.

10. READING and RECOMMENDATION: two sentences each, ceiling. State the consequence — a number, a method, a liability. He already understands masonry; do not explain masonry to him.

11. SCOPE DESCRIPTIONS: one line. What the line covers, not why the line exists.

12. Anything you would have written as reassurance, delete. The document is structurally safe — nothing is committed, every gap is listed, and he can mark it up. Saying so again reads as anxiety.

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
        required: ['project_name','scope','derivation','materials','totals','cross_check','assumptions','open_items','unpriced','tax_lines'],
        properties: {
          project_name:{ type:'string', description:'the job in at most eight words, as Dan would say it aloud' },
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
          /**
           * What used to be a separate call sheet, hardcoded to one job's spider
           * lift. Now it is per-job and it only exists when something is actually
           * unpriced: no unpriced items, no section, no invented errand.
           */
          unpriced:   { type:'array', description:'anything left NOT PRICED, and the shortest route to a real number',
                        items:{ type:'object', required:['item','why','ask'],
                          properties:{ item:{type:'string'}, why:{type:'string', description:'at most 12 words'},
                            ask:{type:'array', items:{type:'string'}, description:'what to ask the supplier or yard, ≤ 8 words each'},
                            measure:{type:'array', items:{type:'string'}, description:'what to measure first, ≤ 8 words each'},
                            first:{type:'string', description:'the single question to lead with, if one dominates'} } } },
          totals:     { type:'object', properties:{ labor:{type:'number'}, materials:{type:'number'},
                            subtotal_ex_access:{type:'number'}, equipment:{type:['number','null']},
                            total:{type:['number','null']}, tax_classification:{type:'string'}, tax_note:{type:'string'} } },
          cross_check:{ type:'object', required:['headline','method_a','method_b','gap','reading','recommendation'],
                        properties:{ headline:{type:'string', description:'the pricing decision in ≤ 10 words'},
                          method_a:{type:'object'}, method_b:{type:'object'},
                          gap:{type:'string'}, reading:{type:'string'}, recommendation:{type:'string'} } },
          assumptions:{ type:'array', items:{type:'object', required:['what','why_it_matters'],
                          properties:{ what:{type:'string'}, why_it_matters:{type:'string'} } } },
          open_items: { type:'array', items:{type:'object', properties:{ item:{type:'string'},
                          impact:{type:'string'}, severity:{type:'string'} } } },
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
   * A total is refused when something is unpriced — not whenever `equipment` is
   * null. Those were the same thing only on the job this was written against.
   * A repointing job that needs no lift at all has a null equipment figure and
   * a perfectly good total, and the old guard silently withheld it.
   */
  const unpriced: any[] = spec.unpriced || [];
  if (unpriced.length && spec.totals?.total != null)
    problems.push(`project total was set while ${unpriced.length} item(s) are unpriced — refusing`);
  if (spec.totals && unpriced.length) spec.totals.total = null;
  if (spec.totals && !unpriced.length && spec.totals.total == null)
    spec.totals.total = scopeSum + (spec.totals.equipment || 0) + (spec.totals.tax || 0);

  spec._validation = problems;
  return spec;
}
