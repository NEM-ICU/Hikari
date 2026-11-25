import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hikari — Learn Japanese from YouTube',
  description: 'Turn Japanese YouTube subtitles into vocabulary cards for Anki.',
  applicationName: 'Hikari',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-[#1a1d24] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
