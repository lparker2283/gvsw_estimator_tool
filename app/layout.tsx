/**
 * Root layout. Deliberately bare: every screen in this app carries its own
 * inline styles, so the layout's only job is the document shell and a margin
 * reset. Nothing here should ever need to know what page it is wrapping.
 */
import { brandFor, DEFAULT_BRAND } from '@/lib/brand';

// The tab title is a surface like any other, so it reads from the tokens too.
const B = brandFor(DEFAULT_BRAND);

export const metadata = {
  title: `${B.proposalPrefix} Estimator`,
  description: `${B.legalName} — estimate questions`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
