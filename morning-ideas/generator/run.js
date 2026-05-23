import 'dotenv/config';
import { research } from './research.js';
import { ideate } from './ideate.js';
import { buildPrototypes } from './prototype.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n=== Morning Ideas Generator ===`);
  console.log(`Date: ${today}\n`);

  console.log('Step 1/3: Researching market niches...');
  const niches = await research();
  console.log('');

  console.log('Step 2/3: Generating app concepts...');
  const ideas = await ideate(niches);
  console.log('');

  console.log('Step 3/3: Building prototypes...');
  const prototypes = await buildPrototypes(ideas);
  console.log('');

  const output = {
    date: today,
    generatedAt: new Date().toISOString(),
    ideas: ideas.map((idea, i) => ({
      ...idea,
      html: prototypes[i]
    }))
  };

  const outputPath = path.join(process.cwd(), 'data', 'prototypes', `${today}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved prototypes to data/prototypes/${today}.json`);

  const usedNichesPath = path.join(process.cwd(), 'data', 'used-niches.json');
  const usedNiches = JSON.parse(fs.readFileSync(usedNichesPath, 'utf-8'));
  const newNiches = niches.map(n => n.niche);
  usedNiches.push(...newNiches);
  fs.writeFileSync(usedNichesPath, JSON.stringify(usedNiches, null, 2));
  console.log(`Updated used niches (${usedNiches.length} total)`);

  const datesPath = path.join(process.cwd(), 'data', 'dates.json');
  let dates = [];
  if (fs.existsSync(datesPath)) {
    dates = JSON.parse(fs.readFileSync(datesPath, 'utf-8'));
  }
  if (!dates.includes(today)) {
    dates.push(today);
    dates.sort().reverse();
  }
  fs.writeFileSync(datesPath, JSON.stringify(dates, null, 2));
  console.log('Updated dates manifest');

  console.log('\n=== Complete! ===\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
