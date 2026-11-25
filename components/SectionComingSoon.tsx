import Link from 'next/link';

interface SectionComingSoonProps {
  title: string;
  japanese: string;
  description: string;
  icon: string;
}

export default function SectionComingSoon({
  title,
  japanese,
  description,
  icon,
}: SectionComingSoonProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#15171d] px-5 py-12 text-gray-100">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm text-gray-400 transition hover:text-white">
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <div className="mx-auto mt-12 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl text-amber-300">
          {icon}
        </div>
        <p className="mt-7 text-xs font-semibold tracking-[0.2em] text-amber-300">COMING SOON</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{japanese}</p>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-gray-400">{description}</p>
        <div className="mx-auto mt-8 h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 rounded-full bg-[#fca311]" />
        </div>
      </div>
    </main>
  );
}
