/**
 * The brain. One Claude call turns a transcript into an extraction plus a
 * SHORT question list. The hard rules live here, not in a prompt suffix.
 */
import Anthropic from '@anthropic-ai/sdk';
import { envSecret } from '@/lib/secrets';
import ratecard from '../data/ratecard.json';
import chimney from '../data/completeness-chimney.json';

// Built on first use: the SDK throws without a key, and Next imports this
// module while collecting page data during the build, where no key exists.
let _anthropic: Anthropic | null = null;
function anthropic() {
  // envSecret, not process.env: a key pasted with the next .env line attached
  // fails inside fetch, and the SDK reports that as a bare "Connection error."
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: envSecret('ANTHROPIC_API_KEY') });
  return _anthropic;
}
const MAX_Q = Number(process.env.MAX_QUESTIONS || 5);

/** The one sentence in this app that is worth being precise about. */
export const ESCAPE_HATCH = "Don't know yet — measure on site";
const ESCAPE_RE = /don.?t know|measure on site|not (yet )?(assessed|sure)|undetermined|unknown/i;

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

5. EVERY question gets a "${ESCAPE_HATCH}" option, worded exactly that way. That answer is legitimate and the documents handle it. Carry that reassurance IN THE OPTION and nowhere else — never in prose, never as a sympathetic aside. The escape hatch is structural; it does not need to be talked about.

6. Mark one option "(recommended)" ONLY where a default is genuinely defensible.

7. Flag anything you assumed in order to price. Assumptions are allowed; silent assumptions are not.

8. Surface findings he did not ask for when the memo implies them — scope alternatives, safety, foreseeable disputes — but say plainly that they are his call, not yours.

9. Rochester specifics that are specifications, not preferences: pre-1930 masonry needs Type N or NHL lime mortar (Portland spalls the face); water-contact surfaces need hydraulic cement (Type S will not hold); 48" frost line in Monroe County; 100+ freeze-thaw cycles a year.

10. Tax: new installation or COMPLETE replacement is a capital improvement; repair or PARTIAL replacement is taxable on the full billed amount. Classify per line, never per job.

LENGTH

He reads this on a phone, standing on a job site, and he is not a words guy. Every word past the decision is a word in his way.

11. QUESTION: at most 8 words, and it must stand on its own — name the thing AND what is being asked about it. "What shape is the crown in?" not "What's the crown doing?" Do not list the options inside the question; the buttons already show them. "What's the scope?" not "What are we actually doing — repointing it, rebuilding the part above the roof, or taking the whole thing down?"

12. WHY: at most 15 words, and only the consequence — a number, a material spec, a liability. It is hidden behind a tap and read by a professional who already understands masonry, so state the stake, never the reasoning. Omit it entirely when the question is self-evident.

13. OPTION LABELS: at most 4 words, in the words a mason would SAY, not the words a condition report would print. "Looks fine" not "Sound". "Shot" not "Failed". "Needs replacing" not "Requires replacement". A bare adjective that only makes sense underneath a heading is not an option label — it has to be readable as an answer to the question, out loud. No trailing explanation, no parentheticals other than the "(recommended)" marker.

Return ONLY the JSON described by the tool schema.`;

export async function extract(transcript: string): Promise<Extraction> {
  const msg = await anthropic().messages.create({
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

  /**
   * The escape hatch is guaranteed, and guaranteed in these exact words.
   *
   * Any variant the model produced is stripped and the canonical string
   * appended, rather than accepting whatever it wrote. "Yet" is the load-bearing
   * word — it frames the gap as in progress rather than as a hole in what he
   * knows — and a paraphrase drops it without ever looking wrong.
   */
  out.questions = out.questions.slice(0, MAX_Q).map(q => {
    const others = (q.options || []).filter(o => !ESCAPE_RE.test(o));
    return { ...q, options: [...others, ESCAPE_HATCH] };
  });
  return out;
}
