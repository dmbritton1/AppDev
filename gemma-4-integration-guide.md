# Integrating Gemma 4 with the Google Gen AI API

A general-purpose guide for adding Gemma 4 features to any JavaScript/Node.js
application using Google's `@google/genai` SDK. This document is written to be
reusable across many apps and is structured so it can be turned into a skill.

---

## 1. Overview

Gemma 4 is an open instruction-tuned model served through the same Google
Generative AI endpoint as Gemini. You call it with the `@google/genai` SDK,
authenticate with a `GEMINI_API_KEY`, and interact with it through the
`generateContent` method.

The model identifier used throughout is:

```
gemma-4-26b-a4b-it
```

Naming convention breakdown:

| Segment | Meaning |
| --- | --- |
| `gemma-4` | Model family and generation |
| `26b` | ~26B total parameters |
| `a4b` | ~4B active parameters (mixture-of-experts) |
| `it` | Instruction-tuned (chat/instruction following) |

Because Gemma is accessed through the Gemini API surface, the request/response
shapes are identical to Gemini calls — only the `model` string changes. This
means you can prototype against Gemini and swap to Gemma (or vice versa) by
changing one field.

---

## 2. Prerequisites & Setup

### Dependencies

```json
{
  "type": "module",
  "dependencies": {
    "@google/genai": "^1.0.0",
    "dotenv": "^16.4.7"
  }
}
```

Install:

```bash
npm install @google/genai dotenv
```

> Note: the SDK targets ES modules. Set `"type": "module"` in `package.json`
> and use `import` syntax (not `require`).

### API key

Create `.env`:

```
GEMINI_API_KEY=your_key_here
```

Provide `.env.example` in the repo so collaborators know what's required, and
make sure `.env` is in `.gitignore`.

Load it at the top of your entry point:

```js
import 'dotenv/config';
```

For CI/CD (e.g. GitHub Actions), store the key as a repository secret named
`GEMINI_API_KEY` and expose it to the job's environment rather than committing
it.

---

## 3. The Core Call Pattern

Every Gemma 4 feature follows the same three-line shape:

```js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const result = await ai.models.generateContent({
  model: 'gemma-4-26b-a4b-it',
  contents: prompt,            // a string, or a structured contents array
  config: { maxOutputTokens: 8192 },  // optional
});

const text = result.text;      // the generated text
```

Key points:

- **`contents`** accepts a plain string for single-turn prompts. For
  multi-turn or multimodal input it accepts a structured array.
- **`config`** is where you set generation parameters such as
  `maxOutputTokens`, `temperature`, etc.
- **`result.text`** is the convenience accessor for the model's text output.
  Always treat it as untrusted/unvalidated until parsed.

### Client construction with timeout

Long generations (large HTML, long documents, big JSON) can exceed default
timeouts. Pass `httpOptions.timeout` (milliseconds) when you expect heavy
output:

```js
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 300000 },   // 5 minutes
});
```

Use a short/default timeout for quick calls and a long one only for the
heavy-generation feature — don't blanket-apply a 5-minute timeout everywhere.

---

## 4. Integration Patterns

These are the three reusable feature shapes. Pick the one that matches what
you're building.

### Pattern A — Structured JSON output

Use when you need machine-readable data back (config objects, lists, records).
Gemma returns text, so you instruct it to emit JSON and then defensively
extract it.

```js
const prompt = `You are a <role>. <task>.

Return a JSON array of objects with these exact fields:
[
  { "field1": "...", "field2": "..." }
]

Return ONLY the JSON array, no markdown code fences, no explanation.`;

const result = await ai.models.generateContent({
  model: 'gemma-4-26b-a4b-it',
  contents: prompt,
});

const text = result.text;

// Defensive extraction — models sometimes wrap output in prose or fences.
const jsonMatch = text.match(/\[[\s\S]*\]/);   // use /\{[\s\S]*\}/ for an object
if (!jsonMatch) {
  console.error('Response text:', text);
  throw new Error('Failed to extract JSON from model response');
}

const data = JSON.parse(jsonMatch[0]);

// Validate shape before trusting it.
if (!Array.isArray(data) || data.length !== EXPECTED_COUNT) {
  throw new Error(`Expected ${EXPECTED_COUNT} items, got ${data.length}`);
}
```

**Best practices for JSON:**

- Explicitly specify *"exact fields"* and give a literal example schema.
- End the prompt with *"Return ONLY the JSON … no markdown code fences."*
- Always regex-extract (`/\{[\s\S]*\}/` for objects, `/\[[\s\S]*\]/` for
  arrays) rather than `JSON.parse(text)` directly — it tolerates stray prose.
- Log the raw `text` on parse failure so you can debug bad generations.
- Validate the parsed structure (length, required keys) before using it.

### Pattern B — Large content generation

Use when generating long-form output (full HTML files, documents, code).

```js
const result = await ai.models.generateContent({
  model: 'gemma-4-26b-a4b-it',
  contents: prompt,
  config: { maxOutputTokens: 8192 },
});

let output = result.text.trim();

// Strip accidental markdown fences if the model wraps the output.
if (output.startsWith('```')) {
  output = output
    .replace(/^```(?:html|json|js|ts)?\n?/, '')
    .replace(/\n?```$/, '');
}
```

**Best practices for large content:**

- Raise `maxOutputTokens` to fit the expected size (e.g. `8192`).
- Use a long client `timeout` (Section 3).
- Number your requirements in the prompt ("every single one is mandatory")
  and be explicit about output format ("Output ONLY … starting with
  `<!DOCTYPE html>`").
- Strip leading/trailing code fences defensively.
- Log the output length (`output.length`) so you can spot truncation.

### Pattern C — Iterating over a batch

Most real features run the model N times over a list. Keep it simple and
sequential when order matters or you want to respect rate limits; log
progress.

```js
const outputs = [];
for (let i = 0; i < items.length; i++) {
  console.log(`  [${i + 1}/${items.length}] Processing: ${items[i].name}`);
  const result = await ai.models.generateContent({
    model: 'gemma-4-26b-a4b-it',
    contents: buildPrompt(items[i]),
  });
  outputs.push(result.text);
}
```

For higher throughput you can parallelize with `Promise.all`, but watch for
rate limits and partial failures — sequential is safer as a default.

### Pattern D — Multi-stage pipelines

Chain calls so each stage's output feeds the next (e.g. *research → ideate →
build*). Keep each stage in its own module exporting one async function, and
orchestrate from a single runner:

```js
import { stageOne } from './stage-one.js';
import { stageTwo } from './stage-two.js';

const a = await stageOne();
const b = await stageTwo(a);
```

Benefits: each stage is independently testable, prompts stay focused, and you
can inspect intermediate output.

---

## 5. Prompt Engineering for Gemma 4

Patterns that work well with this model:

- **Assign a role** up front: *"You are an expert frontend developer."*
- **Enumerate mandatory requirements** as a numbered list; reinforce with
  phrasing like *"every single one is mandatory."*
- **Show, don't tell, for structure** — paste a literal JSON skeleton with the
  exact field names you want.
- **Constrain the output envelope** — end with an explicit instruction such as
  *"Return ONLY the JSON object, no markdown code fences, no explanation."*
- **Ban placeholders** when you want realistic output: *"Never use 'John Doe',
  'lorem ipsum', 'example.com', 'TODO', or 'placeholder'."*
- **Inject dynamic context** via template literals so prompts adapt to runtime
  data (previous results, user input, constraints).

> Caveat: Even with a strict envelope instruction, the model may still wrap
> output in prose or fences occasionally. Always pair prompt constraints with
> defensive parsing (Section 4). Treat the prompt as best-effort, the parser
> as the guarantee.

---

## 6. Error Handling & Robustness

Wrap the pipeline entry point so failures surface clearly and exit non-zero
(important for CI):

```js
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

Checklist for production-grade integration:

- [ ] **Validate every parsed response** (JSON shape, array length, required
      keys) before using it.
- [ ] **Log raw model text on parse failure** for debugging.
- [ ] **Strip markdown fences** from both JSON and large-content outputs.
- [ ] **Set an appropriate `timeout`** for heavy generations.
- [ ] **Set `maxOutputTokens`** high enough to avoid truncation.
- [ ] **Handle rate limits / transient errors** with retries and backoff if
      running at volume.
- [ ] **Fail loudly in automation** (`process.exit(1)`) so scheduled jobs
      report errors.

---

## 7. Persisting & Using Output

A common, simple persistence pattern — write timestamped JSON to disk and
maintain a manifest of what's available:

```js
import fs from 'fs';
import path from 'path';

const today = new Date().toISOString().split('T')[0];

const outputPath = path.join(process.cwd(), 'data', `${today}.json`);
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

// Maintain a manifest so a frontend can discover available files.
const manifestPath = path.join(process.cwd(), 'data', 'index.json');
let manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  : [];
if (!manifest.includes(today)) {
  manifest.push(today);
  manifest.sort().reverse();
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
```

Track state across runs (e.g. previously generated items to avoid repeats) by
reading a JSON file at the start, appending new values, and writing it back.

---

## 8. Automation (GitHub Actions)

To run a Gemma 4 pipeline on a schedule:

1. Add `GEMINI_API_KEY` under **Settings → Secrets and variables → Actions**.
2. Create a workflow with a `cron` schedule and `workflow_dispatch` (manual
   trigger).
3. Expose the secret to the job environment and run your script.

```yaml
name: gemma-pipeline
on:
  schedule:
    - cron: '0 12 * * *'   # adjust for your timezone
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm start
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      # Commit any generated files back if needed.
```

---

## 9. Quick Reference

```js
// 1. Import + construct
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 300000 },     // only for heavy calls
});

// 2. Generate
const result = await ai.models.generateContent({
  model: 'gemma-4-26b-a4b-it',
  contents: prompt,
  config: { maxOutputTokens: 8192 },    // optional
});

// 3. Read + parse defensively
let text = result.text.trim();
const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);  // for JSON outputs
```

| Need | Do this |
| --- | --- |
| Auth | `GEMINI_API_KEY` env var |
| Model | `gemma-4-26b-a4b-it` |
| Long output | `config.maxOutputTokens` + client `timeout` |
| JSON output | prompt for raw JSON, regex-extract, validate |
| Strip fences | `replace(/^```\w*\n?/, '').replace(/\n?```$/, '')` |
| Get text | `result.text` |
| Fail in CI | `.catch(err => { console.error(err); process.exit(1); })` |

---

## 10. Reusability Notes (for applying to multiple apps)

- The **only app-specific parts** are the prompt text and the output schema.
  The client setup, call shape, parsing, and error handling are identical
  across apps.
- Wrap each feature as a single exported async function that takes input and
  returns parsed output — this keeps Gemma logic decoupled from app logic.
- Centralize the model ID (`gemma-4-26b-a4b-it`) in one constant so you can
  swap models or generations in one place.
- Keep prompts in their own module/string so non-engineers can tune them
  without touching the integration code.
