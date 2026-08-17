import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Built on first use, not at import time. Next collects page data during the
 * build, which imports this module — and the build has no Supabase credentials.
 * Constructing eagerly would throw there and fail every deploy.
 */
let client: SupabaseClient | null = null;
function sb() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const db = {
  async createJob(row: any) {
    const { data, error } = await sb().from('jobs').insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async getJobByToken(token: string) {
    const { data } = await sb().from('jobs').select('*').eq('token', token).maybeSingle();
    return data;
  },
  // Used to recognise a webhook retry before it costs anything.
  async getJobByEventId(eventId: string) {
    const { data } = await sb().from('jobs').select('id').eq('event_id', eventId).maybeSingle();
    return data;
  },
  /**
   * Write down a delivery that failed after verification, and say how many
   * times it has now failed.
   *
   * Keyed by event_id so a Svix retry lands on the same row and raises the
   * count instead of adding a second one. That count is what lets the route
   * stop asking for retries: a memo it gives up on is still here, with the
   * email and attachment ids needed to fetch the audio again by hand.
   */
  async recordInboundFailure(row: any): Promise<number> {
    if (row.event_id) {
      const { data: prior } = await sb()
        .from('inbound_failures')
        .select('id, attempts')
        .eq('event_id', row.event_id)
        .maybeSingle();
      if (prior) {
        const attempts = (prior.attempts ?? 1) + 1;
        const { error } = await sb()
          .from('inbound_failures')
          .update({ ...row, attempts, updated_at: new Date().toISOString() })
          .eq('id', prior.id);
        if (error) throw error;
        return attempts;
      }
    }
    const { data, error } = await sb().from('inbound_failures').insert(row).select('attempts').single();
    if (error) throw error;
    return data?.attempts ?? 1;
  },
  async updateJob(id: string, patch: any) {
    const { error } = await sb().from('jobs').update(patch).eq('id', id);
    if (error) throw error;
  },
  async logCorrection(row: any) {
    const { error } = await sb().from('corrections').insert(row);
    if (error) throw error;
  },
  async nextProposalNo() {
    const { data } = await sb().from('config').select('next_proposal_no').eq('id', 1).single();
    const n = data?.next_proposal_no ?? 1;
    await sb().from('config').update({ next_proposal_no: n + 1 }).eq('id', 1);
    return `GVSW-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
  },
  async config() {
    const { data } = await sb().from('config').select('*').eq('id', 1).single();
    return data;
  },
};
