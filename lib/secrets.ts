/**
 * Keeping credentials out of anything anyone reads.
 *
 * Written after a Groq key reached a webhook response body: the value had a
 * stray newline, `Headers.append` rejected it, and the resulting message quoted
 * the header it objected to — key included. Errors that echo their own input
 * are the ordinary case, not a strange one, so nothing that leaves this process
 * should be trusted to be clean.
 */

/** Every secret this app holds, so a message can be checked against the real values. */
function knownSecrets(): string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.DEEPGRAM_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.RESEND_API_KEY,
    process.env.RESEND_INBOUND_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.LINK_SIGNING_SECRET,
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 8);
}

/** Key shapes, for anything that never came from this app's own environment. */
const KEY_SHAPED = /\b(gsk_|sk-ant-|sk-|re_|whsec_|xox[bap]-|AIza|ya29\.)[A-Za-z0-9._\-]{8,}/g;

/**
 * Replace anything secret with a marker. Exact values first, since those are
 * certain; the pattern is a net for keys belonging to somebody else.
 */
export function redact(text: string): string {
  let out = text;
  for (const secret of knownSecrets()) {
    if (out.includes(secret)) out = out.split(secret).join('[redacted]');
    // A pasted value may carry trailing junk, so the first line is checked too.
    const head = secret.split('\n')[0].trim();
    if (head.length > 8 && out.includes(head)) out = out.split(head).join('[redacted]');
  }
  return out.replace(KEY_SHAPED, (_m, prefix) => `${prefix}[redacted]`);
}

/**
 * Read a credential that may have been pasted with company.
 *
 * Copying a line out of a `.env` file tends to bring the next line with it, and
 * the failure that follows names neither the variable nor the cause. The first
 * line is the value; everything after it is the paste.
 */
export function envSecret(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = raw.split(/[\r\n]/)[0].trim();
  if (!value) return undefined;
  if (value !== raw.trim()) {
    console.warn(
      `[env] ${name} contained more than one line; using the first. ` +
        `Check for a pasted .env fragment — the value itself is not logged.`,
    );
  }
  return value;
}
