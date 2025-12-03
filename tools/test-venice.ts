/**
 * Quick test for Venice AI integration
 */

import { VeniceAI } from '@venice-dev-tools/core';

const apiKey = process.env.VENICE_API_KEY || 'zMej4Dp426O4SBebgzjdJBhdiXS6WSn5ddw10-zhNr';

async function test() {
  console.log('Testing Venice AI integration...\n');

  const venice = new VeniceAI({ apiKey });

  try {
    // Test NPC dialogue
    console.log('1. Testing NPC dialogue generation...');
    const response = await venice.chat.createCompletion({
      model: 'llama-3.3-70b',
      messages: [{
        role: 'user',
        content: `You are The King in a fantasy RPG.
PERSONALITY: Wise ruler who welcomes adventurers.
SPEECH STYLE: Regal but warm.

Keep response under 80 characters.
The player "Hero" approaches. Respond in character:`
      }],
      max_tokens: 100,
      temperature: 0.9
    });

    const content = response.choices?.[0]?.message?.content;
    let text = typeof content === 'string' ? content :
      Array.isArray(content) ? content.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('') : '';

    console.log(`   Response: "${text.trim()}"`);
    console.log('   ✅ NPC dialogue working!\n');

    // Test companion hint
    console.log('2. Testing companion hint...');
    const hintResponse = await venice.chat.createCompletion({
      model: 'llama-3.3-70b',
      messages: [{
        role: 'user',
        content: `You are a helpful fairy companion in a fantasy RPG.
SITUATION: Player health is critical (25%)
Give a SHORT helpful hint (under 60 chars). Be encouraging but practical:`
      }],
      max_tokens: 50,
      temperature: 0.9
    });

    const hintContent = hintResponse.choices?.[0]?.message?.content;
    let hint = typeof hintContent === 'string' ? hintContent :
      Array.isArray(hintContent) ? hintContent.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('') : '';

    console.log(`   Hint: "${hint.trim()}"`);
    console.log('   ✅ Companion hints working!\n');

    console.log('🎮 Venice AI integration is ready!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
