/**
 * Root layout. Deliberately bare: every screen in this app carries its own
 * inline styles, so the layout's only job is the document shell and a margin
 * reset. Nothing here should ever need to know what page it is wrapping.
 */
export const metadata = {
  title: 'GVSW Estimator',
  description: 'Genesee Valley Stone Works — estimate questions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
