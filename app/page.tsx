import Link from 'next/link';

const sections = [
  {
    number: '01',
    title: 'Sentence Mining',
    japanese: '文を集める',
    description: 'Turn moments from Japanese videos into useful sentences and vocabulary.',
    href: '/sentence-mining',
    icon: '▶',
    accent: 'from-amber-400/20 to-orange-500/5',
    tag: 'READY TO USE',
    available: true,
  },
  {
    number: '02',
    title: 'Card Learning',
    japanese: 'カードで学ぶ',
    description: 'Review your saved sentence and vocabulary cards with spaced repetition.',
    href: '/cards',
    icon: '▤',
    accent: 'from-sky-400/15 to-blue-500/5',
    tag: 'SUPABASE SETUP',
    available: true,
  },
  {
    number: '03',
    title: 'Kanji Corner',
    japanese: '漢字コーナー',
    description: 'Explore kanji, readings, and words through focused practice.',
    href: '/kanji',
    icon: '漢',
    accent: 'from-rose-400/15 to-pink-500/5',
    tag: 'COMING SOON',
    available: false,
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#15171d] text-gray-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-amber-500/[0.07] blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0b_1px,transparent_1px)] [background-size:28px_28px] opacity-30" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Hikari home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fca311] text-lg font-black text-[#171717] shadow-lg shadow-amber-500/15">
              光
            </span>
            <span className="text-lg font-bold tracking-tight">Hikari</span>
          </Link>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-400">
            JAPANESE STUDY STUDIO
          </span>
        </header>

        <section className="mx-auto w-full max-w-5xl flex-1 py-16 sm:py-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-xs font-medium text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            YOUR NEXT STEP IN JAPANESE
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-6xl sm:leading-[1.08]">
            Learn Japanese from the things you <span className="text-[#fca311]">love.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-gray-400 sm:text-lg">
            Mine real sentences from videos, build a personal vocabulary, and make every study session count.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => {
              const card = (
                <div className={`group relative h-full overflow-hidden rounded-2xl border p-5 transition duration-200 sm:p-6 ${
                  section.available
                      ? 'border-amber-300/25 bg-[#20232b] hover:-translate-y-1 hover:border-amber-300/50 hover:bg-[#252933] hover:shadow-xl hover:shadow-black/20'
                    : 'border-white/[0.08] bg-[#1b1e25] hover:-translate-y-1 hover:border-white/15 hover:bg-[#20232a]'
                }`}>
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${section.accent} opacity-70`} />
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl ${
                        section.available
                          ? 'border-amber-300/20 bg-amber-300/10 text-amber-300'
                          : 'border-white/10 bg-white/[0.04] text-gray-300'
                      }`} aria-hidden="true">{section.icon}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider ${
                        section.available ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {section.tag}
                      </span>
                    </div>
                    <div className="mt-7 flex items-baseline gap-2">
                      <span className="text-xs font-mono text-gray-500">{section.number}</span>
                      <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{section.japanese}</p>
                    <p className="mt-4 min-h-12 text-sm leading-6 text-gray-400">{section.description}</p>
                    <div className={`mt-6 flex items-center gap-2 text-sm font-medium ${section.available ? 'text-[#fca311]' : 'text-gray-400'}`}>
                      {section.available ? 'Start learning' : 'Explore this section'}
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </div>
              );

              return (
                <Link href={section.href} key={section.number} className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fca311]">
                  {card}
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-white/[0.07] pt-5 text-xs text-gray-600">
          <span>Hikari 光</span>
          <span>Small steps, real Japanese.</span>
        </footer>
      </div>
    </main>
  );
}
