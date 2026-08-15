/**
 * Transcription. Provider-swappable because the endpoints are near-identical.
 *
 * Default: Groq whisper-large-v3-turbo. At Dan's volume every provider is free,
 * so this is chosen on accuracy and on VOCABULARY CONTROL, not price.
 *
 * The vocabulary hint is not decoration. The first real memo transcribed
 * "Pittsford" as "Pittsburgh" — a local proper noun, wrong, in the job address.
 * Whisper's `prompt` field biases decoding toward the terms below.
 */

import { envSecret, redact } from '@/lib/secrets';

const VOCAB = [
  // Rochester-area places Dan actually works
  'Pittsford', 'Penfield', 'Brighton', 'Irondequoit', 'Fairport', 'Webster',
  'Honeoye Falls', 'Victor', 'Canandaigua', 'Monroe County', 'Genesee',
  // trade vocabulary that generic models mangle
  'tuckpoint', 'tuckpointing', 'repoint', 'repointing', 'dutchman', 'spalling',
  'efflorescence', 'parging', 'soldier course', 'header course', 'weep hole',
  'NHL lime mortar', 'Type N mortar', 'Type S mortar', 'hydraulic cement',
  'thinset', 'flashing', 'counter flashing', 'chimney crown', 'flue liner',
  'bluestone', 'fieldstone', 'ashlar', 'flagstone', 'lintel', 'frost line',
  'spider lift', 'boom lift', 'scissor lift', 'outriggers', 'Admar',
].join(', ');

const PROMPT = `Masonry contractor field memo, Rochester New York. Likely terms: ${VOCAB}.`;

export async function transcribe(audio: Blob, filename = 'memo.m4a'): Promise<string> {
  // Trimmed for the same reason the keys are: pasted env values arrive with company.
  const provider = (process.env.TRANSCRIBE_PROVIDER || 'groq').split(/[\r\n]/)[0].trim();

  if (provider === 'deepgram') {
    // Nova-3 keyterm boosting is more surgical than a Whisper prompt.
    // Worth switching to if proper nouns are still coming back wrong.
    const terms = VOCAB.split(', ').map(t => `&keyterm=${encodeURIComponent(t)}`).join('');
    const r = await fetch(`https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true${terms}`, {
      method: 'POST',
      headers: { Authorization: `Token ${envSecret('DEEPGRAM_API_KEY') ?? ''}` },
      body: audio,
    });
    if (!r.ok) throw new Error(redact(`deepgram ${r.status}: ${await r.text()}`));
    const j = await r.json();
    return j.results.channels[0].alternatives[0].transcript;
  }

  // Groq and OpenAI share the OpenAI audio/transcriptions shape.
  const isGroq = provider === 'groq';
  const url = isGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';
  const key = envSecret(isGroq ? 'GROQ_API_KEY' : 'OPENAI_API_KEY');
  if (!key) throw new Error(`${isGroq ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} is not set`);
  const model = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';

  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', model);
  form.append('prompt', PROMPT);            // <- the vocabulary fix
  form.append('response_format', 'text');
  form.append('temperature', '0');          // deterministic; we want the literal words

  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) throw new Error(redact(`${provider} ${r.status}: ${await r.text()}`));
  return (await r.text()).trim();
}
