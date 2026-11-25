# Hikari 光 🎌

**Bring Japanese to light, one video and one Anki card at a time.**

Hikari is a Next.js 15 (App Router) web application that lets you:
1. Watch Japanese YouTube videos with synchronized subtitles
2. Click any subtitle line to jump to that moment
3. Press **M** (or click "Mine Line") to extract vocabulary with AI
4. Review and edit the extracted cards
5. Push them directly to Anki with one click

---

## Prerequisites

- **Node.js** 18+
- **Anki** (desktop app) with the **AnkiConnect** add-on
- One AI provider: **Ollama** locally, or an API key for **Hugging Face**, **Groq**, or **DeepSeek**

---

## Setup

### 1. Install AnkiConnect

1. Open Anki → **Tools → Add-ons → Get Add-ons...**
2. Enter code: **`2055492159`**
3. Restart Anki

### 2. Configure AnkiConnect CORS

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

### 3. Configure Anki Note Types

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

# Option B — copy .env.local.example to .env.local and add the API key for
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
5. **Review & edit** — the right panel shows the sentence card and vocabulary cards. Edit any field.
6. **Push to Anki** — select your deck and note types, then click **📤 Push to Anki**.

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
│   ├── layout.tsx          # Root layout with dark theme
│   ├── page.tsx            # Main app page (all state management)
│   ├── globals.css         # Global styles & subtitle animations
│   └── api/
│       └── mine/
│           └── route.ts    # Local Ollama AI endpoint
├── components/
│   ├── Header.tsx          # App header with URL input
│   ├── VideoPlayer.tsx     # react-youtube wrapper
│   ├── SubtitlePanel.tsx   # Synchronized subtitle list
│   ├── PlaybackControls.tsx # Play/pause/seek/mine buttons
│   ├── MiningPreview.tsx   # Right panel with card editor
│   └── SubtitleImport.tsx  # VTT/SRT import dialog
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── ankiConnect.ts      # AnkiConnect client service
│   └── subtitleParser.ts   # VTT/SRT parser utilities
├── .env.local.example      # Environment variable template
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

---

## License

MIT
