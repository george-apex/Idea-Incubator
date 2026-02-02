export const PROMPT_POOL = [
  {
    id: 'interest_delta',
    text: "Has this become more or less interesting since last time?",
    type: 'choice',
    options: ['Much more interesting', 'Slightly more interesting', 'About the same', 'Slightly less interesting', 'Much less interesting']
  },
  {
    id: 'weakest_assumption',
    text: "What's the single weakest assumption right now?",
    type: 'text'
  },
  {
    id: 'next_step',
    text: "What is one concrete next step you could do in under 30 minutes?",
    type: 'text'
  },
  {
    id: 'constraint_risk',
    text: "What would kill this idea quickly (and save you time)?",
    type: 'text'
  },
  {
    id: 'world_change',
    text: "What changed in your world since you last touched this?",
    type: 'text'
  },
  {
    id: 'one_sentence',
    text: "If you had to explain this in one sentence to someone else, what would you say?",
    type: 'text'
  },
  {
    id: 'avoiding',
    text: "Are you avoiding this? If yes, why?",
    type: 'text'
  },
  {
    id: 'smallest_version',
    text: "What's the smallest version that still counts as real?",
    type: 'text'
  },
  {
    id: 'confidence_threshold',
    text: "What would make you confident enough to move it to the next status?",
    type: 'text'
  },
  {
    id: 'opportunity_cost',
    text: "What would you stop doing if you committed to this?",
    type: 'text'
  }
];

const ANCHOR_PROMPTS = ['interest_delta', 'weakest_assumption', 'next_step', 'constraint_risk'];

export function getRandomPrompts(count = 4) {
  const shuffled = [...PROMPT_POOL].sort(() => Math.random() - 0.5);
  
  const selected = [];
  const usedIds = new Set();
  
  for (const prompt of shuffled) {
    if (selected.length >= count) break;
    
    if (ANCHOR_PROMPTS.includes(prompt.id) && !usedIds.has(prompt.id)) {
      selected.push(prompt);
      usedIds.add(prompt.id);
    } else if (!usedIds.has(prompt.id) && selected.length < count) {
      selected.push(prompt);
      usedIds.add(prompt.id);
    }
  }
  
  return selected;
}

export function getPromptSetId(prompts) {
  return prompts.map(p => p.id).sort().join('-');
}
