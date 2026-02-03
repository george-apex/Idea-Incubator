export class AIService {
  constructor(config = {}) {
    this.provider = config.provider || 'tensorix';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl || 'https://api.tensorix.ai/v1';
  }

  async generateIdeasFromNotes(notes) {
    const prompt = this.buildPrompt(notes);
    const response = await this.callAI(prompt);
    return this.parseResponse(response);
  }

  buildPrompt(notes) {
    return `You are an expert at extracting and organizing ideas from meeting notes. 

Analyze the following notes and extract distinct ideas/concepts. For each idea, provide:
1. A clear, concise title
2. A brief summary
3. Confidence level (0-100)
4. Status (e.g., "New", "In Progress", "Review")
5. Color variant (one of: primary, secondary, accent, neutral)
6. Parent idea (if this is a sub-idea of another idea, use the exact title)
7. Related ideas (list of idea titles this connects to)
8. Tags (relevant keywords)

Format your response as valid JSON with this structure:
{
  "ideas": [
    {
      "title": "Idea Title",
      "summary": "Brief description",
      "confidence": 75,
      "status": "New",
      "color_variant": "primary",
      "parent": "Parent Idea Title (or null)",
      "related_to": ["Related Idea 1", "Related Idea 2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

Notes to analyze:
${notes}

Return ONLY valid JSON, no additional text.`;
  }

  async callAI(prompt) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts structured ideas from text and returns valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`AI API Error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  parseResponse(response) {
    try {
      const cleaned = response.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response was:', response);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  async generateLayout(ideas) {
    const prompt = `Generate canvas positions for ${ideas.length} ideas on a 2000x2000 canvas.
Ideas: ${ideas.map(i => i.title).join(', ')}

Return JSON with positions:
{
  "positions": [
    {"title": "Idea Title", "x": 100, "y": 100}
  ]
}

Spread ideas evenly, group related ideas together, avoid overlaps. Return ONLY JSON.`;

    const response = await this.callAI(prompt);
    const parsed = this.parseResponse(response);
    return parsed.positions || [];
  }
}

export function createAIService(config) {
  return new AIService(config);
}
