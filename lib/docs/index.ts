import { htmlToPdf } from '../render';
import { fieldBrief } from './field-brief';
import { proposal } from './proposal';
import { clientNote } from './client-note';
import { callSheet } from './call-sheet';

export type Doc = { name: string; filename: string; pdf: Buffer; audience: 'dan' | 'client' };

export async function buildDocuments(spec: any, extraction: any, transcript: string): Promise<Doc[]> {
  const no = spec.proposal_no;
  const jobs: [string, string, string, Doc['audience']][] = [
    ['Field brief',        `${no}-Field-Brief.pdf`,        fieldBrief(spec),                      'dan'],
    ['Equipment call sheet',`${no}-Call-Sheet.pdf`,        callSheet(spec, extraction),           'dan'],
    ['Project proposal',   `${no}-Proposal.pdf`,           proposal(spec),                        'client'],
    ['Client covering note',`${no}-Client-Note.pdf`,       clientNote(spec),                      'client'],
  ];
  return Promise.all(jobs.map(async ([name, filename, html, audience]) => ({
    name, filename, audience, pdf: await htmlToPdf(html),
  })));
}
