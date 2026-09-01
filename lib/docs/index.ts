import { renderMany } from '../render';
import { brief } from './brief';

/**
 * One document.
 *
 * `proposal.ts`, `client-note.ts` and `call-sheet.ts` are still on disk and are
 * deliberately not imported here. The client-facing pair comes back when the
 * correction ledger has taught the tool something worth putting in front of a
 * client; until then Dan writes the proposal himself, which he was doing anyway
 * and does better than we do. The call sheet is gone for good — it is now a
 * conditional section of the brief, driven by `spec.unpriced`, so it can only
 * appear on a job that actually has something unpriced.
 */
export type Doc = { name: string; filename: string; pdf: Buffer; audience: 'dan' | 'client' };

/** Filenames end up in Drive, in mail clients and on a tablet. Keep them boring. */
const slug = (s: string) => String(s || 'estimate')
  .replace(/[^A-Za-z0-9-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);

export async function buildDocuments(spec: any, extraction: any, _transcript: string): Promise<Doc[]> {
  // The client's name rides in the filename after the number, so a folder of
  // briefs on the tablet reads as jobs rather than as a sequence. The number
  // stays first and intact: the inbound route finds a returned page by it.
  const stem = slug([spec.proposal_no, spec.client].filter(Boolean).join('-'));
  const pages: { name: string; filename: string; audience: Doc['audience']; html: string }[] = [
    { name: 'Brief', filename: `${stem}-Brief.pdf`, audience: 'dan', html: brief(spec, extraction) },
  ];
  // Through renderMany even for one, so that adding a second document back is a
  // line in this array rather than a second browser in the same lambda.
  const pdfs = await renderMany(pages.map(p => p.html));
  return pages.map((p, i) => ({ name: p.name, filename: p.filename, audience: p.audience, pdf: pdfs[i] }));
}
