import { GoogleGenAI } from '@google/genai';

export async function buildPrototypes(ideas) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 300000 } });
  const prototypes = [];

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    console.log(`  [${i + 1}/5] Building prototype: ${idea.name}`);

    const prompt = `You are an expert frontend developer. Build a complete, self-contained HTML file that is a convincing interactive demo of this app:

App Name: ${idea.name}
Problem: ${idea.problem}
Target User: ${idea.targetUser}
Core Features: ${idea.coreFeatures.join(', ')}
Emulation Strategy: ${idea.emulationStrategy}

Requirements — every single one is mandatory:

1. COMPLETELY self-contained — inline ALL CSS in a <style> tag and ALL JavaScript in a <script> tag. Zero external dependencies, zero CDN links, zero imports.
2. Use realistic mock data everywhere — real-seeming names, numbers, dates, addresses, content. Never use "John Doe", "lorem ipsum", "example.com", "coming soon", "placeholder", or "TODO".
3. Emulate backend/API behavior with JavaScript — simulated network delays using setTimeout, fake API responses, mock confirmations and notifications.
4. Make it genuinely interactive — every button, link, and form should do something visible. Data should update in the UI. Include state management.
5. Polish the UI — clean modern design, consistent color palette, good typography with system fonts, proper spacing and alignment, subtle shadows and rounded corners. It should look like a real product, not a school project.
6. Include loading states, success feedback, and smooth transitions/animations.
7. Make the layout responsive and usable at different viewport sizes.
8. Include a header/nav bar with the app name and relevant navigation items.
9. Fill the app with enough content and features that a user could click around and explore for at least 60 seconds.

Output ONLY the complete HTML starting with <!DOCTYPE html>. No markdown fences, no explanation, no commentary — just the raw HTML file.`;

    const result = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: prompt,
      config: { maxOutputTokens: 8192 },
    });
    let html = result.text.trim();

    if (html.startsWith('```')) {
      html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
    }

    prototypes.push(html);
    console.log(`       -> ${html.length} chars`);
  }

  return prototypes;
}
