# Morning Ideas

A daily prototype generator that researches market niches using Gemini with web search, generates 5 app ideas, and builds a working HTML prototype for each one. Results are served through a dashboard hosted on GitHub Pages.

## How it works

Every day the pipeline runs three steps:

1. **Research** — Gemini searches the web for underserved market niches (Reddit complaints, Product Hunt gaps, app store reviews, trending searches). A random creativity constraint is applied each day. Previously used niches are excluded.
2. **Ideate** — For each niche, Gemini generates a structured app concept with name, target user, core features, and an emulation strategy.
3. **Prototype** — For each concept, Gemini generates a complete self-contained HTML file that is a convincing interactive demo of the app.

The output is saved to `data/prototypes/YYYY-MM-DD.json` and the dashboard reads from this file.

## Setup

### Local development

1. Clone the repo
2. Copy `.env.example` to `.env` and add your Gemini API key:
   ```
   cp .env.example .env
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the generator:
   ```
   npm start
   ```

### GitHub Actions (automated daily runs)

1. Push this repo to GitHub
2. Go to **Settings > Secrets and variables > Actions**
3. Add a secret named `GEMINI_API_KEY` with your API key
4. The workflow runs automatically at 7 AM Central time daily
5. You can also trigger it manually from the **Actions** tab

### Dashboard (GitHub Pages)

1. Go to **Settings > Pages**
2. Set source to **Deploy from a branch**
3. Select the `main` branch and `/ (root)` folder
4. The dashboard will be available at `https://<username>.github.io/<repo>/dashboard/`

To use the **Regenerate** button from the dashboard, click **Settings** in the sidebar and add your GitHub repo name (`username/repo`) and a Personal Access Token with the `workflow` scope.

## Structure

```
morning-ideas/
├── .github/workflows/generate.yml   # Daily cron + manual trigger
├── generator/
│   ├── run.js          # Pipeline orchestrator
│   ├── research.js     # Web search for niches
│   ├── ideate.js       # App concept generation
│   └── prototype.js    # HTML prototype generation
├── dashboard/
│   ├── index.html      # Dashboard page
│   ├── style.css       # Styles
│   └── app.js          # Frontend logic
├── data/
│   ├── used-niches.json    # Tracks all used niches
│   ├── dates.json          # Manifest of available dates
│   └── prototypes/         # Daily JSON output files
├── .env.example
├── package.json
└── README.md
```
