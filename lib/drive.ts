import { google } from 'googleapis';
import { Readable } from 'stream';
import type { Doc } from './docs';

/**
 * Drive is the path onto the reMarkable: the device syncs PDFs from an
 * authorised folder. Share that folder with the service account email first.
 *
 * AUTH: two paths, and the keyless one is the default.
 *
 * 1. Workload Identity Federation (production, preferred).
 *    Vercel mints a short-lived OIDC token per invocation; GCP's STS exchanges
 *    it for credentials that impersonate the service account. No long-lived key
 *    exists anywhere — not in Vercel, not in a .env, not in a Downloads folder.
 *    This is also what makes the setup work at all under the
 *    `iam.managed.disableServiceAccountKeyCreation` org policy, which Google
 *    now applies to new organisations by default. The policy is correct; a
 *    downloadable key that never expires is the single most leaked credential
 *    type in cloud infrastructure.
 *
 * 2. A service account JSON key (local dev only, and only if the org allows it).
 *    Used automatically when GOOGLE_SERVICE_ACCOUNT_JSON is present.
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function authClient() {
  // --- local dev path: an explicit key, if one exists ---
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString()
    );
    return new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: SCOPES,
    });
  }

  // --- production path: keyless, via Vercel OIDC ---
  const {
    GCP_PROJECT_NUMBER,
    GCP_SERVICE_ACCOUNT_EMAIL,
    GCP_WORKLOAD_IDENTITY_POOL_ID,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  } = process.env;

  const missing = Object.entries({
    GCP_PROJECT_NUMBER,
    GCP_SERVICE_ACCOUNT_EMAIL,
    GCP_WORKLOAD_IDENTITY_POOL_ID,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  }).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Drive auth unavailable: set GOOGLE_SERVICE_ACCOUNT_JSON for local dev, or ` +
      `configure Workload Identity Federation. Missing: ${missing.join(', ')}`
    );
  }

  // Imported lazily so local runs without the Vercel runtime don't need them.
  const { getVercelOidcToken } = await import('@vercel/oidc');
  const { ExternalAccountClient } = await import('google-auth-library');

  const audience =
    `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}` +
    `/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}` +
    `/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`;

  const client = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: getVercelOidcToken },
  });

  if (!client) throw new Error('Failed to build GCP external account client');
  client.scopes = SCOPES;
  return client as any;
}

/** Returns [] rather than throwing — a Drive failure must not lose the estimate. */
export async function uploadToDrive(docs: Doc[], proposalNo: string): Promise<string[]> {
  if (!process.env.DRIVE_FOLDER_ID) return [];

  const drive = google.drive({ version: 'v3', auth: await authClient() });

  const folder = await drive.files.create({
    requestBody: {
      name: proposalNo,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [process.env.DRIVE_FOLDER_ID],
    },
    fields: 'id, webViewLink',
  });

  const links: string[] = [];
  for (const d of docs) {
    const r = await drive.files.create({
      requestBody: { name: d.filename, parents: [folder.data.id!] },
      media: { mimeType: 'application/pdf', body: Readable.from(d.pdf) },
      fields: 'id, webViewLink',
    });
    links.push(r.data.webViewLink!);
  }
  return links;
}
