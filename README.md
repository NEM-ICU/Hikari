# Hikari 光 🎌

**Bring Japanese to light, one video and one review at a time.**

Hikari is a Next.js 15 (App Router) web application that lets you:
1. Watch Japanese YouTube videos with synchronized subtitles
2. Click any subtitle line to jump to that moment
3. Press **M** (or click "Mine Line") to extract vocabulary with AI
4. Review and edit the extracted cards
5. Save sentence and vocabulary cards to your Hikari library for FSRS review
6. Optionally push cards directly to Anki

---

## Prerequisites

- **Node.js** 20+
- **Supabase** project for account sign-in and cloud-saved study cards
- **Anki** (desktop app) with the **AnkiConnect** add-on (optional)
- One AI provider: **Ollama** locally, or an API key for **Hugging Face**, **Groq**, or **DeepSeek**

---

## Setup

### 1. Configure Supabase study cards

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and public anon key from **Project Settings → API**.
3. In the Supabase SQL Editor, run the migrations in order: [`202611250001_create_study_cards.sql`](supabase/migrations/202611250001_create_study_cards.sql), [`202611250002_create_kanji_corner.sql`](supabase/migrations/202611250002_create_kanji_corner.sql), [`202611250003_kanji_enrich.sql`](supabase/migrations/202611250003_kanji_enrich.sql), [`202611250004_kanji_decks_and_components.sql`](supabase/migrations/202611250004_kanji_decks_and_components.sql), [`202611250005_kanji_review_sessions.sql`](supabase/migrations/202611250005_kanji_review_sessions.sql), [`202611250006_kanji_guided_path.sql`](supabase/migrations/202611250006_kanji_guided_path.sql), [`202611250007_kanji_meaning_only_reviews.sql`](supabase/migrations/202611250007_kanji_meaning_only_reviews.sql), and [`202611260008_kanji_radical_progress.sql`](supabase/migrations/202611260008_kanji_radical_progress.sql).
4. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/**` as a redirect URL. Add your deployed app URL before using email sign-in in production.

The migrations enable row-level security so each signed-in user can access only their own cards, kanji, and review history. Hikari signs users in with an email magic link. Save mined cards from the Sentence Mining preview; review them from **Card Learning**. In **Kanji Corner**, the guided path now starts each level with 18 visual radical lessons, followed by the existing kanji and vocabulary curriculum before advancing the saved profile from N5 through N1. Custom kanji selection and user-created jukugo decks remain available in **Custom study**. The pathway vocabulary is a practical study sequence, not an official JLPT vocabulary list. Anki export remains optional.

### 2. Install AnkiConnect (optional)

1. Open Anki → **Tools → Add-ons → Get Add-ons...**
2. Enter code: **`2055492159`**
3. Restart Anki

### 3. Configure AnkiConnect CORS

AnkiConnect must allow requests from `http://localhost:3000`.

1. Open Anki → **Tools → Add-ons → AnkiConnect → Config**
2. Add `http://localhost:3000` to `webCorsOriginList`:

```json
{
  "apiKey": null,
  "apiLogPath": null,
  "ignoreOriginList": [],
  "webBindAddress": "127.0.0.1",
  "webBindPort": 8765,
  "webCorsOriginList": [
    "http://localhost",
    "http://localhost:3000"
  ]
}
```

3. Click **OK** and restart Anki.

### 4. Configure Anki Note Types

Hikari uses two note types. You can use existing ones or create new ones.

**Sentence Note Type** (fields required):
- `JP_Sentence`
- `Reading`
- `EN_Translation`
- `Sentence_Audio`
- `Sentence_Image`
- `Source_Link`

**Vocabulary Note Type** (fields required):
- `Word`
- `Reading`
- `Meaning`
- `Breakdown`

### 4. Install & Run Hikari

```bash
# Clone / enter the project directory
cd KotoMine

# Install dependencies
npm install

# Option A — completely local and free: install Ollama from https://ollama.com,
# then download the default Japanese-capable model
ollama pull qwen2.5:3b

# Option B — copy .env.example to .env.local and add the API key for
# Hugging Face, Groq, or DeepSeek. Select the provider in the app.

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Load a video** — paste a YouTube URL in the top bar and click **Load**.
2. **Import subtitles** — click **📄 Import Subtitles**, paste VTT/SRT text or upload a file.
3. **Watch & navigate** — click any subtitle line to jump there. Use `Space` to play/pause, `←/→` to seek ±3s.
4. **Choose an AI provider** — select Ollama, Hugging Face, Groq, or DeepSeek above the subtitle list.
5. **Mine a line** — press `M` or click **⛏ Mine Line** to analyze the active subtitle.
6. **Review & edit** — edit the sentence and vocabulary cards in the right panel.
7. **Save to Hikari Library** — save the sentence and vocabulary cards to your Supabase account for review.
8. **Push to Anki (optional)** — select your deck and note types, then click **📤 Push to Anki**.

### Kanji Corner

1. Sign in with your email magic link. Your guided profile starts at N5 and is saved to your account.
2. Complete the level’s 18 radical lessons, then learn its kanji. Complete a meaning check for each character; readings remain visible as study information.
3. Complete that level’s curated jukugo reviews. Each word checks its meaning, with an optional reading reveal.
4. Completing the level’s full word set advances your saved profile to the next level. Reviews from previously unlocked levels remain in the queue.
5. Choose **Custom study** any time to browse arbitrary kanji and create your own vocabulary decks.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` | Seek back 3 seconds |
| `→` | Seek forward 3 seconds |
| `M` | Mine current subtitle line |

---

## Project Structure

```
KotoMine/
├── app/
│   ├── page.tsx            # Home menu
│   ├── sentence-mining/    # Video subtitle mining
│   ├── cards/              # FSRS card review
│   ├── kanji/              # Guided JLPT path and custom kanji study
│   ├── layout.tsx          # Root layout with dark theme
│   ├── globals.css         # Global styles & subtitle animations
│   └── api/                # AI mining and subtitle endpoints
├── components/
│   ├── Header.tsx          # App header with URL input
│   ├── VideoPlayer.tsx     # react-youtube wrapper
│   ├── SubtitlePanel.tsx   # Synchronized subtitle list
│   ├── PlaybackControls.tsx # Play/pause/seek/mine buttons
│   ├── MiningPreview.tsx   # Right panel with card editor
│   ├── SubtitleImport.tsx  # VTT/SRT import dialog
│   ├── KanjiPathway.tsx    # Guided JLPT level progression
│   └── KanjiDecks.tsx      # Custom jukugo decks and reviews
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── studyCards.ts       # Study card types and FSRS serialization
│   ├── supabase.ts         # Supabase browser client
│   ├── ankiConnect.ts      # AnkiConnect client service
│   ├── subtitleParser.ts   # VTT/SRT parser utilities
│   └── kanjiCurriculum.ts  # Curated guided-level kanji and jukugo sets
├── supabase/migrations/    # Study card tables, RLS policies, review RPC
├── .env.example            # Environment variable template
└── README.md
```

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **Video**: react-youtube (YouTube IFrame API)
- **AI**: Selectable Ollama, Hugging Face, Groq, or DeepSeek provider
- **Anki**: AnkiConnect REST API (port 8765)
- **Database/Auth**: Supabase Postgres, Auth, and row-level security
- **Scheduling**: FSRS via `ts-fsrs`

---

## License

MIT
