/**
 * Brand tokens. The tool is one product with many tenants; GVSW is simply the
 * first. Nothing downstream should ever hardcode a hex value or a company name
 * again — the page, the email and the documents all read from here.
 *
 * Adding a client is adding a key to BRANDS. Nothing else.
 */
export type Brand = {
  key: string;
  /** Rendered in the small letterspaced rule at the top of every surface. */
  wordmark: string;
  /** Company name in prose, and in document footers. */
  legalName: string;
  /** Drive folder the finished documents land in. */
  driveFolder: string;
  /** Proposal number prefix, e.g. GVSW-2026-0001. */
  proposalPrefix: string;
  accent: string;      // buttons, wordmark, progress fill
  accentSoft: string;  // fill behind the default option
  bg: string;
  surface: string;
  ink: string;
  inkStrong: string;
  muted: string;
  line: string;
  lineSoft: string;
  font: string;
};

/**
 * Single quotes around the multi-word family, not double.
 *
 * This string is interpolated into `style="…"` attributes in the email HTML, and
 * a double quote inside a double-quoted attribute closes it. The whole
 * declaration was being truncated at `BlinkMacSystemFont,` — every email the
 * tool has ever sent rendered in the browser's default serif, at default size,
 * with the colour and width lost. It looked like a deliberate choice, which is
 * why nobody caught it.
 */
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

export const BRANDS: Record<string, Brand> = {
  gvsw: {
    key: 'gvsw',
    wordmark: 'GENESEE VALLEY STONE WORKS',
    legalName: 'Genesee Valley Stone Works',
    driveFolder: 'GVSW Estimates',
    proposalPrefix: 'GVSW',
    accent: '#3f4a3c',
    accentSoft: '#f7f8f5',
    bg: '#fbfaf7',
    surface: '#ffffff',
    ink: '#33322e',
    inkStrong: '#1a1a19',
    muted: '#807b72',
    line: '#e2ddd3',
    lineSoft: '#e5e1d8',
    font: SANS,
  },
};

export const DEFAULT_BRAND = 'gvsw';

export function brandFor(key?: string | null): Brand {
  return BRANDS[key ?? ''] ?? BRANDS[DEFAULT_BRAND];
}
