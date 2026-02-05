export function renderSearchBox(state) {
  return `
    <div class="search-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          class="search-box"
          id="search-box"
          placeholder="Search ideas... (try: 'mobile app performance')"
          value="${state.searchQuery || ''}"
          autocomplete="off"
        />
        ${state.searchQuery ? `
          <button class="search-clear" id="search-clear" title="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : ''}
        <button class="search-toggle" id="search-toggle" title="Search options">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      <div class="search-options" id="search-options" style="display: ${state.searchQuery ? 'block' : 'none'};">
        <label class="search-option">
          <input type="checkbox" id="use-semantic" ${state.searchOptions.useSemantic ? 'checked' : ''}>
          <span>Semantic Search</span>
        </label>
        <label class="search-option">
          <input type="checkbox" id="use-keyword" ${state.searchOptions.useKeyword ? 'checked' : ''}>
          <span>Keyword Search</span>
        </label>
      </div>
    </div>
  `;
}

export function renderSearchResults(state) {
  if (!state.searchQuery || state.searchResults.length === 0) {
    return '';
  }

  return `
    <div class="search-results-panel">
      <div class="search-results-header">
        <span class="results-count">${state.searchResults.length} results for "${state.searchQuery}"</span>
        <div class="search-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="semantic">Semantic</button>
          <button class="filter-btn" data-filter="keyword">Keyword</button>
        </div>
      </div>
      <div class="search-results-list">
        ${state.searchResults.map(result => renderSearchResult(result)).join('')}
      </div>
    </div>
  `;
}

export function renderSearchResult(result) {
  const { idea, score, matchType, explanation } = result;

  return `
    <div class="search-result" data-idea-id="${idea.id}" data-match-type="${matchType}">
      <div class="result-header">
        <h3 class="result-title">${escapeHtml(idea.title)}</h3>
        <div class="result-meta">
          <span class="match-type-badge ${matchType}">${matchType}</span>
          <span class="relevance-score">${score}% relevant</span>
        </div>
      </div>
      <div class="result-body">
        <p class="result-summary">${escapeHtml(idea.summary)}</p>
        ${explanation ? `<p class="result-explanation">${escapeHtml(explanation)}</p>` : ''}
      </div>
      <div class="result-footer">
        <div class="result-tags">
          ${idea.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="result-actions">
          <button class="btn-view" data-idea-id="${idea.id}">View</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function setupSearchEventListeners(state) {
  const searchBox = document.getElementById('search-box');
  const searchClear = document.getElementById('search-clear');
  const searchToggle = document.getElementById('search-toggle');
  const searchOptions = document.getElementById('search-options');
  const useSemantic = document.getElementById('use-semantic');
  const useKeyword = document.getElementById('use-keyword');

  let searchTimeout;

  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      searchTimeout = setTimeout(() => {
        state.performSearch(query);
      }, 300);
    });

    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        state.clearSearchResults();
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      state.clearSearchResults();
    });
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', () => {
      const isHidden = searchOptions.style.display === 'none';
      searchOptions.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (useSemantic) {
    useSemantic.addEventListener('change', (e) => {
      state.setSearchOptions({ useSemantic: e.target.checked });
    });
  }

  if (useKeyword) {
    useKeyword.addEventListener('change', (e) => {
      state.setSearchOptions({ useKeyword: e.target.checked });
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const filter = e.target.dataset.filter;
      if (filter === 'all') {
        state.setSearchOptions({ useSemantic: true, useKeyword: true });
      } else if (filter === 'semantic') {
        state.setSearchOptions({ useSemantic: true, useKeyword: false });
      } else if (filter === 'keyword') {
        state.setSearchOptions({ useSemantic: false, useKeyword: true });
      }
    });
  });

  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ideaId = e.target.dataset.ideaId;
      state.setSelectedIdeaId(ideaId);
    });
  });
}
