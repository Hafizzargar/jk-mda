import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KJIN | Kashmir Jammu Information Network',
  description: 'Independent, verified, multilingual news and information for Kashmir and Jammu.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
