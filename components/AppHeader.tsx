'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AccountMenu from '@/components/AccountMenu';
import ThemeToggle from '@/components/ThemeToggle';
import { useSupabaseSession } from '@/lib/useSupabaseSession';

const links = [
  { href: '/', label: 'Home' },
  { href: '/sentence-mining', label: 'Sentence Mining' },
  { href: '/cards', label: 'Card Learning' },
  { href: '/kanji', label: 'Kanji Corner' },
];

export default function AppHeader() {
  const pathname = usePathname();
  // Sentence Mining has its own video URL bar, which hosts the same controls.
  if (pathname.startsWith('/sentence-mining')) return null;

  return <AppHeaderBar pathname={pathname} />;
}

function AppHeaderBar({ pathname }: { pathname: string }) {
  const { client, session } = useSupabaseSession();

  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-900/[0.04] backdrop-blur dark:border-white/10 dark:bg-[#1a1d24]/95">
    <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" aria-label="Hikari home">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fca311] text-sm font-black text-[#171717]">光</span>
        <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Hikari</span>
      </Link>

      <nav aria-label="Main navigation" className="hidden h-full items-center gap-1 md:flex">
        {links.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={`inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-medium transition ${active ? 'bg-orange-50 text-orange-800 dark:bg-orange-400/10 dark:text-orange-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>
            {link.label}
          </Link>;
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {client && session && <AccountMenu client={client} email={session.user.email ?? 'Account'} />}
        <ThemeToggle />
      </div>
    </div>
  </header>;
}
