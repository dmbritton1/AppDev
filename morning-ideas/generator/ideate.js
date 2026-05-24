import { GoogleGenerativeAI } from '@google/generative-ai';

export async function ideate(niches) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const ideas = [];

  for (let i = 0; i < niches.length; i++) {
    const niche = niches[i];
    console.log(`  [${i + 1}/5] Ideating: ${niche.niche}`);

    const prompt = `You are an app designer. Create a detailed app concept for this market niche:

Niche: ${niche.niche}
Description: ${niche.description}
Evidence: ${niche.evidence}

Generate a structured app concept as a JSON object with these exact fields:

{
  "name": "a catchy, memorable, brandable app name",
  "niche": "the market gap it targets",
  "problem": "the specific pain point this solves",
  "targetUser": "who this is for — be specific about demographics and situation",
  "coreFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "realDependencies": ["what APIs or services a real version would need"],
  "emulationStrategy": "how the demo will fake those dependencies convincingly with mock data, simulated delays, and fake API responses"
}

The name should be creative and memorable. Include 3-5 core features. The emulation strategy should be detailed enough for a developer to implement a convincing fake.

Return ONLY the JSON object, no markdown code fences, no explanation.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Response text:', text);
      throw new Error(`Failed to parse idea JSON for niche: ${niche.niche}`);
    }

    const idea = JSON.parse(jsonMatch[0]);
    ideas.push(idea);
    console.log(`       -> ${idea.name}`);
  }

  return ideas;
}
