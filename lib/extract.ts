/**
 * The brain. One Claude call turns a transcript into an extraction plus a
 * SHORT question list. The hard rules live here, not in a prompt suffix.
 */
import Anthropic from '@anthropic-ai/sdk';
import ratecard from '../data/ratecard.json';
import chimney from '../data/completeness-chimney.json';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_Q = Number(process.env.MAX_QUESTIONS || 5);

export type Question = {
  id: string;
  q: string;
  why: string;                 // shown small, under the question
  options?: string[];          // tappable; one may carry "(recommended)"
  unit?: string;
};

export type Extraction = {
  category: string;
  fields: { field: string; value: string; confidence: 'high'|'medium'|'low'; source: string; consequence: string }[];
  suppressed: { question: string; why: string }[];
  refusals: { item: string; reason: string }[];
  findings: { finding: string; implication: string; severity: 'high'|'medium'|'low' }[];
  questions: Question[];
};

const SYSTEM = `You are the estimating engine for Genesee Valley Stone Works, a one-man masonry business in Rochester NY. You read a mason's voice memo and prepare an estimate.

NON-NEGOTIABLE RULES

1. NEVER invent a job fact. Every field you extract must quote the words that produced it. If the memo does not contain something, it is either a question or an open item — never a value.

2. NEVER price equipment the mason has not obtained a quote for. If he says he hasn't called a rental yard, the access line is NOT PRICED and you say why.

3. ASK AT MOST ${MAX_Q} QUESTIONS. Rank by how much the answer moves the number, the method, or the liability. Anything past ${MAX_Q} becomes an open item shipped with the estimate. A mason who opens nine questions closes the tab.

4. SUPPRESS questions the memo already answered or made irrelevant. A chimney that vents nothing needs no liner question. Record what you suppressed and why — that is the work.

5. EVERY question gets an "I don't know — measure on site" option. That answer is legitimate and the documents handle it. Never make him feel stupid for not knowing.

6. Mark one option "(recommended)" ONLY where a default is genuinely defensible.

7. Flag anything you assumed in order to price. Assumptions are allowed; silent assumptions are not.

8. Surface findings he did not ask for when the memo implies them — scope alternatives, safety, foreseeable disputes — but say plainly that they are his call, not yours.

9. Rochester specifics that are specifications, not preferences: pre-1930 masonry needs Type N or NHL lime mortar (Portland spalls the face); water-contact surfaces need hydraulic cement (Type S will not hold); 48" frost line in Monroe County; 100+ freeze-thaw cycles a year.

10. Tax: new installation or COMPLETE replacement is a capital improvement; repair or PARTIAL replacement is taxable on the full billed amount. Classify per line, never per job.

Return ONLY the JSON described by the tool schema.`;

export async function extract(transcript: string): Promise<Extraction> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: SYSTEM,
    tools: [{
      name: 'estimate_intake',
      description: 'Structured reading of the memo plus the question set.',
      input_schema: {
        type: 'object',
        required: ['category', 'fields', 'suppressed', 'refusals', 'findings', 'questions'],
        properties: {
          category:  { type: 'string', description: 'chimney | brick | stone | historic' },
          fields:    { type: 'array', items: { type: 'object',
                        required: ['field','value','confidence','source','consequence'],
                        properties: { field:{type:'string'}, value:{type:'string'},
                          confidence:{type:'string',enum:['high','medium','low']},
                          source:{type:'string',description:'verbatim quote from the memo'},
                          consequence:{type:'string'} } } },
          suppressed:{ type: 'array', items: { type:'object', required:['question','why'],
                        properties:{ question:{type:'string'}, why:{type:'string'} } } },
          refusals:  { type: 'array', items: { type:'object', required:['item','reason'],
                        properties:{ item:{type:'string'}, reason:{type:'string'} } } },
          findings:  { type: 'array', items: { type:'object', required:['finding','implication','severity'],
                        properties:{ finding:{type:'string'}, implication:{type:'string'},
                          severity:{type:'string',enum:['high','medium','low']} } } },
          questions: { type: 'array', maxItems: MAX_Q, items: { type:'object', required:['id','q','why'],
                        properties:{ id:{type:'string'}, q:{type:'string'}, why:{type:'string'},
                          options:{type:'array',items:{type:'string'}}, unit:{type:'string'} } } },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'estimate_intake' },
    messages: [{ role: 'user', content:
      `RATE CARD:\n${JSON.stringify(ratecard)}\n\n` +
      `COMPLETENESS RULES FOR CHIMNEY WORK (adapt the same logic to other categories):\n${JSON.stringify(chimney)}\n\n` +
      `MEMO TRANSCRIPT:\n"""${transcript}"""` }],
  });

  const block: any = msg.content.find((c: any) => c.type === 'tool_use');
  const out = block.input as Extraction;

  // Belt and braces: the "don't know" escape hatch is guaranteed, not hoped for.
  out.questions = out.questions.slice(0, MAX_Q).map(q => ({
    ...q,
    options: q.options?.some(o => /don.?t know|measure on site/i.test(o))
      ? q.options
      : [...(q.options || []), "Don't know — measure on site"],
  }));
  return out;
}
