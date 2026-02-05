# Semantic Search Design Plan

## Overview
Design and implement an intelligent semantic search system that dynamically understands user queries and finds semantically related ideas within the canvas, going beyond simple keyword matching.

## Current State Analysis

### Existing Search Implementation
- **Location**: `src/app/state.js:69-76`
- **Method**: Simple string matching (includes)
- **Fields Searched**: title, summary, tags
- **Limitations**:
  - No understanding of meaning/context
  - No synonym handling
  - No fuzzy matching
  - No relevance scoring
  - No query expansion

### Existing AI Infrastructure
- **AI Service**: `src/services/ai_service.js`
- **Provider**: Tensorix (configurable)
- **Model**: z-ai/glm-4.7
- **Capabilities**: Chat completions, JSON parsing
- **Status**: Working and tested

### Existing Tag System
- **Tag Suggestion Service**: `src/services/tag_suggestion_service.js`
- **Tag Vocabulary**: Stored in IndexedDB
- **Tag Relationships**: Co-occurrence tracking
- **Status**: Recently implemented

---

## Design Goals

### Primary Goals
1. **Semantic Understanding**: Understand the meaning behind queries, not just keywords
2. **Context Awareness**: Consider the full context of ideas (problem, solution, assumptions)
3. **Dynamic Results**: Real-time search with intelligent ranking
4. **Explainable**: Show why results are relevant
5. **Hybrid Approach**: Combine semantic and keyword search for best results

### Secondary Goals
1. **Query Expansion**: Suggest related search terms
2. **Visual Feedback**: Highlight matching concepts in results
3. **Search History**: Save and reuse searches
4. **Faceted Search**: Filter by semantic categories
5. **Offline-First**: Work without external APIs when possible

---

## Architecture Design

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Search Interface                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Search Input │  │ Suggestions  │  │ Results View │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Search Orchestrator                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Query Parser │  │ Router       │  │ Result Merger │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Keyword      │    │ Semantic     │    │ Hybrid       │
│ Search       │    │ Search       │    │ Ranker       │
└──────────────┘    └──────────────┘    └──────────────┘
         │                    │
         ▼                    ▼
┌──────────────┐    ┌──────────────┐
│ IndexedDB    │    │ Vector Store │
│ (Ideas)      │    │ (Embeddings) │
└──────────────┘    └──────────────┘
```

### Data Flow

1. **User Input**: User types query in search box
2. **Query Analysis**: Parse and understand intent
3. **Parallel Search**:
   - Keyword search (fast, exact matches)
   - Semantic search (slower, meaning-based)
4. **Result Merging**: Combine and rank results
5. **UI Update**: Display results with explanations

---

## Technical Implementation

### Phase 1: Vector Embeddings (Foundation)

#### 1.1 Embedding Service
**File**: `src/services/embedding_service.js`

```javascript
export class EmbeddingService {
  constructor(config) {
    this.provider = config.provider || 'tensorix';
    this.apiKey = config.apiKey;
    this.model = config.model || 'text-embedding-ada-002';
    this.cache = new Map(); // In-memory cache
  }

  // Generate embedding for a single text
  async generateEmbedding(text) {
    // Check cache first
    const cacheKey = this.hashText(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Call AI API
    const embedding = await this.callEmbeddingAPI(text);
    this.cache.set(cacheKey, embedding);
    return embedding;
  }

  // Generate embeddings for multiple texts (batch)
  async generateEmbeddings(texts) {
    return Promise.all(texts.map(t => this.generateEmbedding(t)));
  }

  // Calculate cosine similarity between two embeddings
  calculateSimilarity(embedding1, embedding2) {
    // Cosine similarity formula
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2);
  }
}
```

#### 1.2 Vector Store
**File**: `src/db/vector_store.js`

```javascript
export class VectorStore {
  constructor(db) {
    this.db = db;
    this.embeddings = new Map(); // In-memory for fast access
  }

  // Store embedding for an idea
  async storeEmbedding(ideaId, embedding, metadata) {
    // Store in IndexedDB
    // Update in-memory cache
  }

  // Get embedding for an idea
  async getEmbedding(ideaId) {
    // Check cache first
    // Fall back to IndexedDB
  }

  // Find similar ideas by embedding
  async findSimilar(queryEmbedding, limit = 10, threshold = 0.7) {
    // Calculate similarity with all stored embeddings
    // Return top matches above threshold
  }

  // Batch index all ideas
  async indexAllIdeas(ideas) {
    // Generate embeddings for all ideas
    // Store in vector store
  }
}
```

#### 1.3 Database Schema Updates
**File**: `src/db/schema.js`

```javascript
export const DB_VERSION = 3; // Increment from 2

export const STORES = {
  ideas: 'ideas',
  settings: 'settings',
  exports_log: 'exports_log',
  tag_vocabulary: 'tag_vocabulary',
  tag_relationships: 'tag_relationships',
  embeddings: 'embeddings', // NEW
  search_cache: 'search_cache' // NEW
};

// In onupgradeneeded:
if (!db.objectStoreNames.contains(STORES.embeddings)) {
  const embeddingsStore = db.createObjectStore(STORES.embeddings, { keyPath: 'ideaId' });
  embeddingsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
}

if (!db.objectStoreNames.contains(STORES.search_cache)) {
  const cacheStore = db.createObjectStore(STORES.search_cache, { keyPath: 'queryHash' });
  cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
}
```

---

### Phase 2: Semantic Search Engine

#### 2.1 Search Service
**File**: `src/services/search_service.js`

```javascript
export class SearchService {
  constructor(embeddingService, vectorStore) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
  }

  // Main search method
  async search(query, ideas, options = {}) {
    const {
      useKeyword = true,
      useSemantic = true,
      semanticThreshold = 0.7,
      limit = 20
    } = options;

    const results = [];

    // Parallel search
    const [keywordResults, semanticResults] = await Promise.all([
      useKeyword ? this.keywordSearch(query, ideas) : [],
      useSemantic ? this.semanticSearch(query, limit, semanticThreshold) : []
    ]);

    // Merge and rank results
    return this.mergeResults(keywordResults, semanticResults);
  }

  // Keyword search (existing implementation)
  keywordSearch(query, ideas) {
    const queryLower = query.toLowerCase();
    return ideas
      .filter(idea =>
        idea.title.toLowerCase().includes(queryLower) ||
        idea.summary.toLowerCase().includes(queryLower) ||
        idea.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
      .map(idea => ({
        idea,
        score: this.calculateKeywordScore(idea, query),
        matchType: 'keyword',
        matchedFields: this.getMatchedFields(idea, query)
      }));
  }

  // Semantic search (new)
  async semanticSearch(query, limit, threshold) {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Find similar ideas
    const similarIdeas = await this.vectorStore.findSimilar(
      queryEmbedding,
      limit,
      threshold
    );

    return similarIdeas.map(result => ({
      idea: result.idea,
      score: result.similarity,
      matchType: 'semantic',
      explanation: this.generateExplanation(result)
    }));
  }

  // Merge and rank results
  mergeResults(keywordResults, semanticResults) {
    // Combine results, deduplicate, and re-rank
    // Weight semantic matches higher
    // Return sorted by relevance
  }

  // Calculate keyword score
  calculateKeywordScore(idea, query) {
    // Score based on:
    // - Exact title match (highest)
    // - Partial title match
    // - Summary match
    // - Tag match
  }

  // Get matched fields for highlighting
  getMatchedFields(idea, query) {
    // Return which fields matched
  }

  // Generate explanation for semantic match
  generateExplanation(result) {
    // Explain why this idea is semantically related
    // e.g., "Related to: mobile, app, performance"
  }
}
```

#### 2.2 Query Understanding
**File**: `src/services/query_analyzer.js`

```javascript
export class QueryAnalyzer {
  // Analyze query to understand intent
  analyzeQuery(query) {
    return {
      original: query,
      normalized: this.normalizeQuery(query),
      tokens: this.tokenize(query),
      entities: this.extractEntities(query),
      intent: this.detectIntent(query),
      filters: this.extractFilters(query),
      expanded: this.expandQuery(query)
    };
  }

  // Normalize query (lowercase, remove punctuation)
  normalizeQuery(query) {
    return query.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  // Tokenize into words/phrases
  tokenize(query) {
    // Extract meaningful tokens
  }

  // Extract entities (tech terms, dates, etc.)
  extractEntities(query) {
    // Identify:
    // - Technology names (React, Python, etc.)
    // - Status terms (shipped, building, etc.)
    // - Time expressions (recent, last week)
  }

  // Detect search intent
  detectIntent(query) {
    // Determine if user is looking for:
    // - Specific idea (title match)
    // - Category of ideas
    // - Related concepts
    // - Status-based search
  }

  // Extract filters from query
  extractFilters(query) {
    // Parse natural language filters:
    // "high confidence ideas" -> { confidence: { min: 70 } }
    // "shipped last month" -> { status: 'shipped', date: { range: 'last_month' } }
  }

  // Expand query with synonyms and related terms
  expandQuery(query) {
    // Add related terms:
    // "mobile" -> ["mobile", "app", "ios", "android"]
    // "performance" -> ["performance", "speed", "optimization", "fast"]
  }
}
```

---

### Phase 3: UI Enhancements

#### 3.1 Enhanced Search Box
**File**: `src/ui/search.js`

```javascript
export function renderSearch(state) {
  return `
    <div class="search-container">
      <div class="search-input-wrapper">
        <input
          type="text"
          class="search-box"
          id="search-box"
          placeholder="Search ideas... (try: 'mobile app performance')"
          autocomplete="off"
        />
        <button class="search-toggle" id="search-toggle" title="Search options">
          <svg>...</svg>
        </button>
      </div>
      <div class="search-suggestions" id="search-suggestions" style="display: none;">
        <!-- Dynamic suggestions -->
      </div>
      <div class="search-options" id="search-options" style="display: none;">
        <label>
          <input type="checkbox" id="use-semantic" checked>
          Semantic Search
        </label>
        <label>
          <input type="checkbox" id="use-keyword" checked>
          Keyword Search
        </label>
        <div class="search-threshold">
          <label>Semantic Threshold:</label>
          <input type="range" id="semantic-threshold" min="0.5" max="0.95" step="0.05" value="0.7">
          <span id="threshold-value">0.7</span>
        </div>
      </div>
    </div>
  `;
}

export function renderSearchResults(results, query) {
  return `
    <div class="search-results">
      <div class="search-results-header">
        <span class="results-count">${results.length} results for "${query}"</span>
        <div class="search-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="semantic">Semantic</button>
          <button class="filter-btn" data-filter="keyword">Keyword</button>
        </div>
      </div>
      <div class="search-results-list">
        ${results.map(result => renderSearchResult(result)).join('')}
      </div>
    </div>
  `;
}

export function renderSearchResult(result) {
  const { idea, score, matchType, matchedFields, explanation } = result;

  return `
    <div class="search-result" data-idea-id="${idea.id}" data-match-type="${matchType}">
      <div class="result-header">
        <h3 class="result-title">${highlightMatches(idea.title, matchedFields)}</h3>
        <div class="result-meta">
          <span class="match-type-badge ${matchType}">${matchType}</span>
          <span class="relevance-score">${Math.round(score * 100)}% relevant</span>
        </div>
      </div>
      <div class="result-body">
        <p class="result-summary">${highlightMatches(idea.summary, matchedFields)}</p>
        ${explanation ? `<p class="result-explanation">${explanation}</p>` : ''}
      </div>
      <div class="result-footer">
        <div class="result-tags">
          ${idea.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="result-actions">
          <button class="btn-view" data-idea-id="${idea.id}">View</button>
          <button class="btn-add-to-canvas" data-idea-id="${idea.id}">Add to Canvas</button>
        </div>
      </div>
    </div>
  `;
}

function highlightMatches(text, matchedFields) {
  // Highlight matched terms in text
}
```

#### 3.2 Search Suggestions
**File**: `src/ui/search_suggestions.js`

```javascript
export async function showSearchSuggestions(query, state) {
  const suggestions = await generateSearchSuggestions(query, state);

  return `
    <div class="search-suggestions">
      <div class="suggestion-section">
        <div class="suggestion-title">Quick Actions</div>
        <div class="suggestion-items">
          <button class="suggestion-item" data-action="search-all">
            <span class="suggestion-icon">🔍</span>
            Search all ideas
          </button>
          <button class="suggestion-item" data-action="search-due">
            <span class="suggestion-icon">⏰</span>
            Search due ideas
          </button>
          <button class="suggestion-item" data-action="search-high-confidence">
            <span class="suggestion-icon">💪</span>
            High confidence ideas
          </button>
        </div>
      </div>
      ${suggestions.relatedQueries.length > 0 ? `
        <div class="suggestion-section">
          <div class="suggestion-title">Related Searches</div>
          <div class="suggestion-items">
            ${suggestions.relatedQueries.map(q => `
              <button class="suggestion-item" data-query="${q}">
                <span class="suggestion-icon">💡</span>
                ${q}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${suggestions.matchingIdeas.length > 0 ? `
        <div class="suggestion-section">
          <div class="suggestion-title">Matching Ideas</div>
          <div class="suggestion-items">
            ${suggestions.matchingIdeas.slice(0, 3).map(idea => `
              <button class="suggestion-item idea-suggestion" data-idea-id="${idea.id}">
                <span class="suggestion-icon">💭</span>
                ${idea.title}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function generateSearchSuggestions(query, state) {
  // Generate:
  // - Related queries (query expansion)
  // - Matching ideas (top 3)
  // - Quick actions
}
```

#### 3.3 Search Results Panel
**File**: `src/ui/search_results.js`

```javascript
export function renderSearchResultsPanel(results, query, state) {
  return `
    <div class="search-results-panel">
      <div class="results-header">
        <h2>Search Results</h2>
        <div class="query-info">
          <span class="query-text">"${query}"</span>
          <button class="clear-search" id="clear-search">Clear</button>
        </div>
      </div>

      <div class="results-stats">
        <div class="stat-item">
          <span class="stat-label">Total Results</span>
          <span class="stat-value">${results.length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Semantic Matches</span>
          <span class="stat-value">${results.filter(r => r.matchType === 'semantic').length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Keyword Matches</span>
          <span class="stat-value">${results.filter(r => r.matchType === 'keyword').length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Relevance</span>
          <span class="stat-value">${Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length * 100)}%</span>
        </div>
      </div>

      <div class="results-filters">
        <select class="sort-select" id="sort-results">
          <option value="relevance">Sort by Relevance</option>
          <option value="confidence">Sort by Confidence</option>
          <option value="date">Sort by Date</option>
          <option value="title">Sort by Title</option>
        </select>
        <select class="filter-select" id="filter-match-type">
          <option value="all">All Match Types</option>
          <option value="semantic">Semantic Only</option>
          <option value="keyword">Keyword Only</option>
        </select>
      </div>

      <div class="results-list">
        ${results.map(result => renderSearchResult(result)).join('')}
      </div>

      ${results.length === 0 ? `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try different keywords or adjust your search threshold</p>
          <div class="search-tips">
            <h4>Search Tips:</h4>
            <ul>
              <li>Use more general terms</li>
              <li>Try related concepts</li>
              <li>Lower the semantic threshold</li>
              <li>Check for typos</li>
            </ul>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
```

---

### Phase 4: Integration

#### 4.1 State Management Updates
**File**: `src/app/state.js`

```javascript
class AppState {
  constructor() {
    // ... existing properties
    this.searchService = null;
    this.embeddingService = null;
    this.vectorStore = null;
    this.searchResults = [];
    this.searchOptions = {
      useSemantic: true,
      useKeyword: true,
      semanticThreshold: 0.7
    };
  }

  async init() {
    // ... existing init
    await this.initSearchServices();
  }

  async initSearchServices() {
    const { EmbeddingService } = await import('../services/embedding_service.js');
    const { VectorStore } = await import('../db/vector_store.js');
    const { SearchService } = await import('../services/search_service.js');

    this.embeddingService = new EmbeddingService({
      provider: this.settings.aiProvider,
      apiKey: this.settings.aiApiKey
    });

    const db = await openDatabase();
    this.vectorStore = new VectorStore(db);

    this.searchService = new SearchService(
      this.embeddingService,
      this.vectorStore
    );

    // Index all ideas if not already indexed
    await this.ensureIdeasIndexed();
  }

  async ensureIdeasIndexed() {
    // Check which ideas need embeddings
    // Generate embeddings for new/updated ideas
    // Store in vector store
  }

  async performSearch(query) {
    this.searchQuery = query;
    this.searchResults = await this.searchService.search(
      query,
      this.ideas,
      this.searchOptions
    );
    this.notify();
  }

  setSearchOptions(options) {
    this.searchOptions = { ...this.searchOptions, ...options };
    if (this.searchQuery) {
      this.performSearch(this.searchQuery);
    }
  }
}
```

#### 4.2 Event Handlers
**File**: `src/app/app.js`

```javascript
function setupSearchEventListeners(state) {
  const searchBox = document.getElementById('search-box');
  const searchToggle = document.getElementById('search-toggle');
  const searchOptions = document.getElementById('search-options');
  const useSemantic = document.getElementById('use-semantic');
  const useKeyword = document.getElementById('use-keyword');
  const semanticThreshold = document.getElementById('semantic-threshold');

  let searchTimeout;

  searchBox.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query.length >= 2) {
      searchTimeout = setTimeout(() => {
        state.performSearch(query);
      }, 300);
    } else {
      state.searchResults = [];
      state.notify();
    }
  });

  searchToggle.addEventListener('click', () => {
    searchOptions.style.display = searchOptions.style.display === 'none' ? 'block' : 'none';
  });

  useSemantic.addEventListener('change', (e) => {
    state.setSearchOptions({ useSemantic: e.target.checked });
  });

  useKeyword.addEventListener('change', (e) => {
    state.setSearchOptions({ useKeyword: e.target.checked });
  });

  semanticThreshold.addEventListener('input', (e) => {
    document.getElementById('threshold-value').textContent = e.target.value;
    state.setSearchOptions({ semanticThreshold: parseFloat(e.target.value) });
  });
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `embedding_service.js`
- [ ] Create `vector_store.js`
- [ ] Update database schema to version 3
- [ ] Add embedding storage methods to `idb.js`
- [ ] Test embedding generation with AI API
- [ ] Implement cosine similarity calculation

### Phase 2: Search Engine (Week 2-3)
- [ ] Create `search_service.js`
- [ ] Create `query_analyzer.js`
- [ ] Implement keyword search (refactor existing)
- [ ] Implement semantic search
- [ ] Implement result merging and ranking
- [ ] Add search caching

### Phase 3: UI Components (Week 3-4)
- [ ] Create `search.js` with enhanced search box
- [ ] Create `search_suggestions.js`
- [ ] Create `search_results.js`
- [ ] Add search options panel
- [ ] Implement result highlighting
- [ ] Add search statistics

### Phase 4: Integration (Week 4)
- [ ] Update `state.js` with search services
- [ ] Update `app.js` with search event handlers
- [ ] Update `sidebar.js` to show search results
- [ ] Add search results panel to main view
- [ ] Implement search history
- [ ] Add keyboard shortcuts (Cmd/Ctrl+K)

### Phase 5: Polish & Testing (Week 5)
- [ ] Performance optimization
- [ ] Offline fallback (keyword-only)
- [ ] Error handling and edge cases
- [ ] User testing and feedback
- [ ] Documentation
- [ ] Bug fixes

---

## Technical Considerations

### Performance
1. **Embedding Caching**: Cache embeddings in memory and IndexedDB
2. **Batch Processing**: Generate embeddings in batches for efficiency
3. **Debouncing**: Debounce search input (300ms)
4. **Lazy Loading**: Only index ideas when needed
5. **Web Workers**: Offload embedding generation to background thread

### Offline Support
1. **Fallback to Keyword Search**: When AI API unavailable
2. **Local Embeddings**: Consider using a smaller local model
3. **Cache Strategy**: Aggressive caching of embeddings
4. **Sync Strategy**: Queue embedding generation for offline

### Privacy & Security
1. **API Key Storage**: Store securely in settings
2. **Data Privacy**: Don't send sensitive data to external APIs
3. **Opt-in**: Make semantic search opt-in
4. **Clear Data**: Provide option to clear embeddings

### Scalability
1. **Vector Index**: Use efficient data structures (HNSW, IVF)
2. **Pagination**: Implement result pagination
3. **Incremental Updates**: Only re-index changed ideas
4. **Storage Limits**: Monitor IndexedDB storage usage

---

## User Experience

### Search Flow
1. User types in search box
2. Real-time suggestions appear
3. Results update as user types (debounced)
4. Results show relevance score and match type
5. User can filter by match type
6. User can adjust semantic threshold
7. Clicking result opens idea detail

### Visual Design
- **Semantic matches**: Blue badge with relevance %
- **Keyword matches**: Green badge
- **Highlighting**: Bold matched terms
- **Explanation**: Show why semantic match is relevant
- **Progress indicator**: Show loading state for semantic search

### Accessibility
- **Keyboard navigation**: Arrow keys to navigate results
- **Screen reader support**: Proper ARIA labels
- **High contrast**: Clear visual distinction
- **Focus management**: Logical tab order

---

## Success Metrics

### Quantitative
- Search accuracy (user satisfaction rating)
- Average search time (< 500ms for keyword, < 2s for semantic)
- Semantic match relevance (> 70% user approval)
- Search usage frequency
- Zero-result rate reduction

### Qualitative
- User feedback on search quality
- Ability to find ideas without exact keywords
- Understanding of why results are shown
- Overall satisfaction with search experience

---

## Future Enhancements

### Short-term
1. **Search History**: Save and reuse searches
2. **Saved Searches**: Bookmark common searches
3. **Search Analytics**: Track popular searches
4. **Voice Search**: Dictate search queries
5. **Image Search**: Search by uploaded images

### Long-term
1. **Personalization**: Learn from user behavior
2. **Collaborative Filtering**: "Users who searched X also found Y"
3. **Auto-discovery**: Suggest related ideas proactively
4. **Cross-project Search**: Search across multiple projects
5. **AI-powered Query Refinement**: Suggest better queries

---

## Risks & Mitigations

### Risk 1: AI API Cost
- **Mitigation**: Implement caching, use cheaper models, offer opt-out

### Risk 2: Performance Issues
- **Mitigation**: Debouncing, lazy loading, Web Workers

### Risk 3: Poor Search Quality
- **Mitigation**: Hybrid approach, user feedback loop, threshold tuning

### Risk 4: Storage Limits
- **Mitigation**: Monitor usage, implement cleanup, compression

### Risk 5: Privacy Concerns
- **Mitigation**: Clear opt-in, local processing option, data deletion

---

## Conclusion

This semantic search system will significantly enhance the Idea Incubator by enabling users to find ideas based on meaning rather than just keywords. The hybrid approach ensures both speed and accuracy, while the modular design allows for incremental implementation and future enhancements.

The implementation is divided into 5 phases over 5 weeks, with each phase building on the previous one. The system is designed to be performant, offline-capable, and user-friendly, with clear visual feedback and explanations for search results.
