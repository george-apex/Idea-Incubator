export class AIService {
  constructor(config = {}) {
    this.provider = config.provider || 'tensorix';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'z-ai/glm-4.7';
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

IMPORTANT: Organize ideas into a proper hierarchy with multiple top-level ideas and sub-ideas. 
- Create 3-5 main top-level ideas (no parent)
- Group related sub-ideas under their appropriate parent
- Avoid creating a linear chain where each idea has the previous one as parent
- Each top-level idea should have 2-4 sub-ideas

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
      const headers = {
        'Content-Type': 'application/json'
      };

      headers['Authorization'] = `Bearer ${this.apiKey}`;

      const requestBody = {
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
        max_tokens: 8000
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = response.statusText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(`AI API Error: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('AI API Response:', data);
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI API Call Error:', error);
      throw error;
    }
  }

  parseResponse(response) {
    console.log('AI Raw Response:', response);
    console.log('Response length:', response.length);
    
    try {
      let cleaned = response.trim();
      
      // Remove markdown code blocks if present
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Check if response is truncated (doesn't end with closing braces)
      const isTruncated = !cleaned.endsWith('}') && !cleaned.endsWith(']}');
      if (isTruncated) {
        console.warn('Response appears to be truncated');
      }
      
      // Try to find JSON object in the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('AI Parsed Response:', parsed);
        return parsed;
      }
      
      // Try parsing the entire response as JSON
      const parsed = JSON.parse(cleaned);
      console.log('AI Parsed Response:', parsed);
      return parsed;
    } catch (error) {
      console.error('JSON Parse Error:', error);
      console.error('Response that failed to parse:', response);
      
      // Try to extract ideas from malformed response using regex
      try {
        const ideas = this.extractIdeasFromMalformedResponse(response);
        if (ideas.length > 0) {
          console.log('Extracted ideas from malformed response:', ideas);
          return { ideas };
        }
      } catch (extractError) {
        console.error('Failed to extract ideas from malformed response:', extractError);
      }
      
      throw new Error(`Failed to parse AI response as JSON: ${error.message}. Raw response: ${response.substring(0, 200)}...`);
    }
  }

  extractIdeasFromMalformedResponse(response) {
    const ideas = [];
    const lines = response.split('\n');
    let currentIdea = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for title patterns
      const titleMatch = trimmed.match(/["']?title["']?\s*[:=]\s*["']([^"']+)["']/i);
      if (titleMatch) {
        if (currentIdea) ideas.push(currentIdea);
        currentIdea = { title: titleMatch[1], summary: '', confidence: 50, status: 'New', color_variant: 'primary', parent: null, related_to: [], tags: [] };
      }
      
      // Look for summary patterns
      const summaryMatch = trimmed.match(/["']?summary["']?\s*[:=]\s*["']([^"']+)["']/i);
      if (summaryMatch && currentIdea) {
        currentIdea.summary = summaryMatch[1];
      }
      
      // Look for confidence patterns
      const confidenceMatch = trimmed.match(/["']?confidence["']?\s*[:=]\s*(\d+)/i);
      if (confidenceMatch && currentIdea) {
        currentIdea.confidence = parseInt(confidenceMatch[1]);
      }
      
      // Look for status patterns
      const statusMatch = trimmed.match(/["']?status["']?\s*[:=]\s*["']([^"']+)["']/i);
      if (statusMatch && currentIdea) {
        currentIdea.status = statusMatch[1];
      }
      
      // Look for parent patterns
      const parentMatch = trimmed.match(/["']?parent["']?\s*[:=]\s*["']([^"']+)["']/i);
      if (parentMatch && currentIdea) {
        currentIdea.parent = parentMatch[1];
      }
    }
    
    if (currentIdea) ideas.push(currentIdea);
    return ideas;
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
