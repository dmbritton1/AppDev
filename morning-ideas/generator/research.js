import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const CREATIVITY_CONSTRAINTS = [
  'B2B tools only',
  'consumer mobile only',
  'single-screen apps only',
  'voice or audio-first',
  'tools for a specific profession',
  'hyperlocal or community-focused',
  'hardware companion apps',
  'tools for the elderly',
  'tools for creators',
  'sustainability or climate-focused'
];

export async function research() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const usedNichesPath = path.join(process.cwd(), 'data', 'used-niches.json');
  const usedNiches = JSON.parse(fs.readFileSync(usedNichesPath, 'utf-8'));

  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const constraint = CREATIVITY_CONSTRAINTS[dayOfYear % CREATIVITY_CONSTRAINTS.length];

  console.log(`  Creativity constraint: ${constraint}`);
  console.log(`  Excluding ${usedNiches.length} previously used niches`);

  const usedNichesList = usedNiches.length > 0
    ? `\n\nCRITICAL: Do NOT suggest any of these niches that have already been used in prior runs. Avoid anything similar to:\n${usedNiches.map(n => `- ${n}`).join('\n')}\n\nYou must come up with completely different, fresh niches.`
    : '';

  const prompt = `You are a market researcher looking for underserved app niches. Search the web to find real gaps in the market.

Search for:
1. Reddit posts where people complain about lacking tools or apps
2. Trending searches that suggest unmet needs
3. Product Hunt - look for categories with few recent launches
4. App store reviews where people wish for features that don't exist

Today's creative constraint: ALL 5 ideas must fit "${constraint}".
${usedNichesList}

Return exactly 5 distinct, specific niche opportunities as a JSON array. Each should be narrow and actionable, not broad categories.

Format as a JSON array of objects:
[
  {
    "niche": "short niche name",
    "description": "2-3 sentence description of the specific gap",
    "evidence": "what real signals suggest this gap exists",
    "constraint": "${constraint}"
  }
]

Return ONLY the JSON array, no markdown code fences, no explanation before or after.`;

  const result = await ai.models.generateContent({
    model: 'gemma-4-26b-a4b-it',
    contents: prompt,
  });
  const text = result.text;

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Response text:', text);
    throw new Error('Failed to extract niches JSON from Gemini response');
  }

  const niches = JSON.parse(jsonMatch[0]);

  if (niches.length !== 5) {
    throw new Error(`Expected 5 niches, got ${niches.length}`);
  }

  for (const niche of niches) {
    console.log(`  -> ${niche.niche}`);
  }

  return niches;
}
