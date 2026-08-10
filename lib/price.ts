/**
 * Pricing. Turns extraction + answers into a priced job spec.
 * Two methods are always computed and the disagreement is reported, never hidden.
 */
import Anthropic from '@anthropic-ai/sdk';
import ratecard from '../data/ratecard.json';

// Built on first use: the SDK throws without a key, and Next imports this
// module while collecting page data during the build, where no key exists.
let _anthropic: Anthropic | null = null;
function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

Return ONLY the tool JSON.`;

export async function price(extraction: any, answers: Record<string, string>) {
  const msg = await anthropic().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: SYSTEM,
    tools: [{
      name: 'priced_job',
      description: 'A fully derived job spec.',
      input_schema: {
        type: 'object',
        required: ['scope','derivation','materials','timeline','totals','cross_check','assumptions','open_items','tax_lines','exclusions','overview','client_note'],
        properties: {
          overview:   { type:'string' },
          client_note:{ type:'array', items:{type:'string'}, description:'plain-language paragraphs for the client covering note' },
          scope:      { type:'array', items:{type:'object', required:['task','description','unit','cost','contingent'],
                          properties:{ task:{type:'string'}, description:{type:'string'}, unit:{type:'string'},
                            cost:{type:['number','null']}, contingent:{type:'boolean'}, contingency_note:{type:'string'} } } },
          derivation: { type:'array', items:{type:'object', required:['line','card','range','qty','chosen','rationale'],
                          properties:{ line:{type:'string'}, card:{type:'string'}, range:{type:'string'},
                            qty:{type:'string'}, low:{type:['number','null']}, high:{type:['number','null']},
                            chosen:{type:['number','null']}, rationale:{type:'string'} } } },
          materials:  { type:'array', items:{type:'object', properties:{ material:{type:'string'}, spec:{type:'string'},
                            supplier:{type:'string'}, qty:{type:'string'}, unit:{type:'string'}, cost:{type:'number'} } } },
          timeline:   { type:'array', items:{type:'object', properties:{ phase:{type:'string'}, target:{type:'string'},
                            duration:{type:'string'}, notes:{type:'string'} } } },
          onsite_days:{ type:'number', description:'days equipment is on site, incl. siting and strike' },
          totals:     { type:'object', properties:{ labor:{type:'number'}, materials:{type:'number'},
                            subtotal_ex_access:{type:'number'}, equipment:{type:['number','null']},
                            total:{type:['number','null']}, tax_classification:{type:'string'}, tax_note:{type:'string'} } },
          cross_check:{ type:'object', required:['method_a','method_b','gap','reading','recommendation'],
                        properties:{ method_a:{type:'object'}, method_b:{type:'object'},
                          gap:{type:'string'}, reading:{type:'string'}, recommendation:{type:'string'} } },
          assumptions:{ type:'array', items:{type:'object', required:['what','why_it_matters'],
                          properties:{ what:{type:'string'}, why_it_matters:{type:'string'} } } },
          open_items: { type:'array', items:{type:'object', properties:{ item:{type:'string'},
                          impact:{type:'string'}, severity:{type:'string'} } } },
          tax_lines:  { type:'array', items:{type:'object', properties:{ line:{type:'string'},
                          cls:{type:'string'}, basis:{type:'string'} } } },
          exclusions: { type:'array', items:{type:'string'} },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'priced_job' },
    messages: [{ role: 'user', content:
      `RATE CARD:\n${JSON.stringify(ratecard)}\n\n` +
      `EXTRACTION:\n${JSON.stringify(extraction)}\n\n` +
      `ANSWERS FROM DAN:\n${JSON.stringify(answers)}` }],
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

  if (spec.totals?.equipment == null && spec.totals?.total != null)
    problems.push('project total was set while equipment is unpriced — refusing');
  if (spec.totals?.equipment == null) spec.totals.total = null;

  spec._validation = problems;
  return spec;
}
