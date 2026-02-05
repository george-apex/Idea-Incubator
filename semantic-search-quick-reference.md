# Semantic Search - Quick Reference

## File Structure

```
src/
├── services/
│   ├── embedding_service.js      [NEW] Generate vector embeddings
│   ├── search_service.js         [NEW] Main search orchestration
│   └── query_analyzer.js         [NEW] Query understanding
├── db/
│   ├── vector_store.js           [NEW] Embedding storage & retrieval
│   ├── schema.js                 [UPDATE] Add embeddings, search_cache stores
│   └── idb.js                    [UPDATE] Add embedding CRUD methods
├── ui/
│   ├── search.js                 [NEW] Enhanced search box
│   ├── search_suggestions.js     [NEW] Search suggestions
│   └── search_results.js         [NEW] Results panel
├── app/
│   ├── state.js                  [UPDATE] Add search services
│   └── app.js                    [UPDATE] Search event handlers
└── styles/
    └── search.css                [NEW] Search UI styles
```

## Key Classes & Methods

### EmbeddingService
```javascript
class EmbeddingService {
  async generateEmbedding(text)           // Generate embedding for text
  async generateEmbeddings(texts)         // Batch generate embeddings
  calculateSimilarity(emb1, emb2)         // Cosine similarity
  hashText(text)                          // Generate cache key
}
```

### VectorStore
```javascript
class VectorStore {
  async storeEmbedding(ideaId, embedding, metadata)
  async getEmbedding(ideaId)
  async findSimilar(queryEmbedding, limit, threshold)
  async indexAllIdeas(ideas)
  async clearEmbeddings()
}
```

### SearchService
```javascript
class SearchService {
  async search(query, ideas, options)     // Main search method
  keywordSearch(query, ideas)             // Keyword matching
  async semanticSearch(query, limit, threshold)
  mergeResults(keywordResults, semanticResults)
  calculateKeywordScore(idea, query)
  generateExplanation(result)
}
```

### QueryAnalyzer
```javascript
class QueryAnalyzer {
  analyzeQuery(query)                     // Full analysis
  normalizeQuery(query)
  tokenize(query)
  extractEntities(query)
  detectIntent(query)
  extractFilters(query)
  expandQuery(query)
}
```

## Database Schema Changes

### New Stores

**embeddings**
```javascript
{
  ideaId: string (key),
  embedding: number[],                    // Vector array
  metadata: {
    title: string,
    summary: string,
    tags: string[],
    updatedAt: timestamp
  },
  updatedAt: timestamp (indexed)
}
```

**search_cache**
```javascript
{
  queryHash: string (key),                // Hash of query + options
  query: string,
  options: object,
  results: object[],                      // Cached results
  timestamp: timestamp (indexed)
}
```

## State Management

### New Properties
```javascript
this.searchService = null;
this.embeddingService = null;
this.vectorStore = null;
this.searchResults = [];
this.searchOptions = {
  useSemantic: true,
  useKeyword: true,
  semanticThreshold: 0.7
};
```

### New Methods
```javascript
async initSearchServices()
async ensureIdeasIndexed()
async performSearch(query)
setSearchOptions(options)
clearSearchResults()
```

## UI Components

### Search Box
- Enhanced input with suggestions
- Toggle for search options
- Semantic threshold slider
- Real-time results

### Search Results
- Relevance score display
- Match type badges (semantic/keyword)
- Highlighted matches
- Explanation for semantic matches
- Filter by match type
- Sort options

### Search Suggestions
- Quick actions (search all, due, high confidence)
- Related queries
- Top matching ideas

## Search Flow

```
User Input
    ↓
Query Analysis (normalize, tokenize, expand)
    ↓
Parallel Search
    ├─→ Keyword Search (fast, exact matches)
    └─→ Semantic Search (slower, meaning-based)
         ↓
         Generate Query Embedding
         ↓
         Find Similar Embeddings (cosine similarity)
    ↓
Merge Results (deduplicate, re-rank)
    ↓
Display Results (with explanations)
```

## Configuration

### Settings
```javascript
{
  aiProvider: 'tensorix',                 // or 'openai', 'anthropic'
  aiApiKey: 'your-api-key',
  embeddingModel: 'text-embedding-ada-002',
  semanticThreshold: 0.7,                 // 0.5 - 0.95
  useSemanticSearch: true,
  useKeywordSearch: true,
  cacheEmbeddings: true,
  maxCacheSize: 1000
}
```

## Performance Tips

1. **Cache Embeddings**: Store in memory + IndexedDB
2. **Batch Processing**: Generate embeddings in batches of 10-20
3. **Debounce Input**: 300ms delay before searching
4. **Lazy Indexing**: Only index when needed
5. **Web Workers**: Offload embedding generation
6. **Result Limiting**: Default to 20 results max

## Testing Checklist

### Unit Tests
- [ ] Embedding generation
- [ ] Cosine similarity calculation
- [ ] Vector storage/retrieval
- [ ] Keyword search
- [ ] Semantic search
- [ ] Result merging
- [ ] Query analysis

### Integration Tests
- [ ] Full search flow
- [ ] Search with no results
- [ ] Search with many results
- [ ] Search options changes
- [ ] Caching behavior
- [ ] Offline fallback

### UI Tests
- [ ] Search input handling
- [ ] Suggestions display
- [ ] Results rendering
- [ ] Filtering/sorting
- [ ] Keyboard navigation
- [ ] Responsive design

## Common Issues & Solutions

### Issue: Slow search performance
**Solution**: Increase debounce time, reduce result limit, use caching

### Issue: Poor semantic matches
**Solution**: Lower threshold, improve query expansion, check embeddings

### Issue: High API costs
**Solution**: Aggressive caching, batch processing, cheaper model

### Issue: Storage limits exceeded
**Solution**: Implement cleanup, compress embeddings, monitor usage

### Issue: No results for valid query
**Solution**: Check threshold, verify embeddings exist, try keyword-only

## Migration Path

### From Current Search
1. Keep existing keyword search as fallback
2. Add semantic search as opt-in feature
3. Gradually index all ideas in background
4. Enable semantic search by default after testing

### Data Migration
```javascript
// Migrate existing ideas to have embeddings
async function migrateIdeas() {
  const ideas = await getAllIdeas();
  for (const idea of ideas) {
    if (!await hasEmbedding(idea.id)) {
      await generateAndStoreEmbedding(idea);
    }
  }
}
```

## API Endpoints (Future)

If adding backend support:
```
POST /api/search
POST /api/embeddings/generate
GET  /api/embeddings/:ideaId
POST /api/embeddings/batch
DELETE /api/embeddings/:ideaId
```

## Monitoring

### Metrics to Track
- Search latency (p50, p95, p99)
- API call count/cost
- Cache hit rate
- Zero-result rate
- User satisfaction (feedback)

### Logging
```javascript
console.log('Search performed', {
  query,
  resultCount,
  matchTypes,
  latency,
  usedCache
});
```

## Security Considerations

1. **API Keys**: Never expose in client code
2. **Data Privacy**: Don't send sensitive content
3. **Rate Limiting**: Implement client-side throttling
4. **Input Validation**: Sanitize all queries
5. **CORS**: Configure properly for API calls

## Browser Compatibility

- **Embeddings API**: Requires fetch + async/await
- **IndexedDB**: All modern browsers
- **Web Workers**: Chrome 4+, Firefox 3.5+, Safari 4+
- **Vector Math**: Native JS, no polyfills needed

## Dependencies

No new npm packages required! Uses:
- Existing AI service infrastructure
- Native IndexedDB
- Native Web Workers (optional)
- Native Math functions

## Estimated Effort

- **Phase 1** (Foundation): 8-12 hours
- **Phase 2** (Search Engine): 12-16 hours
- **Phase 3** (UI Components): 16-20 hours
- **Phase 4** (Integration): 8-12 hours
- **Phase 5** (Polish): 8-12 hours

**Total**: 52-72 hours (6-9 days)

## Next Steps

1. Review and approve design
2. Set up development branch
3. Begin Phase 1 implementation
4. Test each phase before proceeding
5. Gather user feedback
6. Iterate and refine
