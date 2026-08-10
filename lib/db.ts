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
