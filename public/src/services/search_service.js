export class SearchService {
  constructor(aiService) {
    this.aiService = aiService;
    this.cache = new Map();
  }

  async search(query, ideas, options = {}) {
    const {
      useKeyword = true,
      useSemantic = true,
      limit = 20
    } = options;

    const results = [];

    if (useKeyword) {
      const keywordResults = this.keywordSearch(query, ideas);
      results.push(...keywordResults);
    }

    if (useSemantic && this.aiService) {
      const semanticResults = await this.semanticSearch(query, ideas, limit);
      results.push(...semanticResults);
    }

    return this.mergeAndRankResults(results, limit);
  }

  keywordSearch(query, ideas) {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 0);

    return ideas
      .map(idea => {
        const titleMatch = idea.title.toLowerCase().includes(queryLower);
        const summaryMatch = idea.summary.toLowerCase().includes(queryLower);
        const tagMatches = idea.tags.filter(tag => 
          tag.toLowerCase().includes(queryLower)
        );

        let score = 0;
        const matchedFields = [];

        if (titleMatch) {
          score += 100;
          matchedFields.push('title');
        }

        if (summaryMatch) {
          score += 50;
          matchedFields.push('summary');
        }

        if (tagMatches.length > 0) {
          score += 30 * tagMatches.length;
          matchedFields.push('tags');
        }

        if (score > 0) {
          return {
            idea,
            score: Math.min(score, 100),
            matchType: 'keyword',
            matchedFields,
            explanation: null
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  async semanticSearch(query, ideas, limit) {
    const cacheKey = this.hashQuery(query);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = this.buildSearchPrompt(query, ideas, limit);
      const response = await this.aiService.callAI(prompt);
      const parsed = this.aiService.parseResponse(response);
      
      const results = this.parseSearchResults(parsed, ideas);
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  buildSearchPrompt(query, ideas, limit) {
    const ideasSummary = ideas.map(idea => 
      `ID: ${idea.id}\nTitle: ${idea.title}\nSummary: ${idea.summary}\nTags: ${idea.tags.join(', ')}\nConfidence: ${idea.confidence}\nStatus: ${idea.status}`
    ).join('\n\n---\n\n');

    return `You are an intelligent search assistant. Find the most relevant ideas for the user's search query.

Search Query: "${query}"

Available Ideas:
${ideasSummary}

Return the top ${limit} most relevant ideas as JSON:
{
  "results": [
    {
      "idea_id": "idea-id-here",
      "relevance_score": 0.95,
      "explanation": "Brief explanation of why this idea is relevant (1-2 sentences)"
    }
  ]
}

Guidelines:
- Relevance score should be between 0.0 and 1.0
- Consider semantic meaning, not just keyword matches
- Explain why each result is relevant
- Return ONLY valid JSON, no additional text`;
  }

  parseSearchResults(parsed, ideas) {
    if (!parsed.results || !Array.isArray(parsed.results)) {
      return [];
    }

    return parsed.results
      .map(result => {
        const idea = ideas.find(i => i.id === result.idea_id);
        if (!idea) return null;

        return {
          idea,
          score: Math.round(result.relevance_score * 100),
          matchType: 'semantic',
          matchedFields: [],
          explanation: result.explanation || null
        };
      })
      .filter(Boolean);
  }

  mergeAndRankResults(results, limit) {
    const merged = new Map();

    for (const result of results) {
      const existing = merged.get(result.idea.id);
      
      if (existing) {
        if (result.matchType === 'semantic' && existing.matchType === 'keyword') {
          merged.set(result.idea.id, result);
        } else if (result.score > existing.score) {
          merged.set(result.idea.id, result);
        }
      } else {
        merged.set(result.idea.id, result);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  hashQuery(query) {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  clearCache() {
    this.cache.clear();
  }
}

export function createSearchService(aiService) {
  return new SearchService(aiService);
}
