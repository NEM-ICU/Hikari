import type { Metadata } from 'next';
import AppHeader from '@/components/AppHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hikari — Learn Japanese from YouTube',
  description: 'Mine Japanese sentences, save cards, and review them with spaced repetition.',
  applicationName: 'Hikari',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { if (localStorage.getItem('hikari-theme') === 'dark') document.documentElement.className = 'dark'; } catch {}" }} />
      </head>
      <body className="bg-[#1a1d24] text-gray-100 antialiased">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
