export function showAIImportDialog(state) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  let generatedIdeas = [];
  let generatedSuggestions = [];

  container.innerHTML = `
    <div class="modal-overlay" id="ai-import-modal">
      <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;">
        <h2 style="margin-bottom: 16px;">AI-Powered Idea Import</h2>
        
        <div style="margin-bottom: 20px; padding: 16px; background: rgba(90, 166, 200, 0.1); border-radius: 8px; border-left: 4px solid var(--color-accent-blue);">
          <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary);">
            <strong>How it works:</strong> Paste your meeting notes or brainstorming session, and AI will automatically extract distinct ideas, identify relationships, and create connected bubbles on your canvas.
          </p>
        </div>

        <div style="margin-bottom: 16px;">
          <label for="ai-api-key" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">
            Tensorix API Key
            <span style="font-weight: normal; color: var(--color-text-secondary); font-size: 12px;">
              (Get one at <a href="https://tensorix.ai" target="_blank" style="color: var(--color-accent-blue);">tensorix.ai</a>)
            </span>
          </label>
          <input 
            type="password" 
            id="ai-api-key" 
            placeholder="sk-..." 
            value="${state.settings.aiApiKey || ''}"
            style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--color-outline); font-family: monospace;"
          />
          <p style="margin-top: 6px; font-size: 12px; color: var(--color-text-secondary);">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="ai-notes" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">
                Meeting Notes / Brainstorming Text
              </label>
              <textarea 
                id="ai-notes" 
                rows="8" 
                placeholder="Paste your meeting notes here...

Example:
- We need to improve user onboarding
- The signup flow is too complex
- Consider adding a tutorial
- Mobile app needs better performance
- Analytics dashboard is confusing
- Should add real-time data updates"
                style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--color-outline); resize: vertical;"
              ></textarea>
              <div style="margin-top: 12px;">
                <label for="ai-suggestions-toggle" style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" id="ai-suggestions-toggle" checked>
                  <span style="font-size: 14px; font-weight: 500;">Generate AI Suggestions</span>
                </label>
                <p style="margin: 4px 0 0 24px; font-size: 12px; color: var(--color-text-secondary);">
                  AI will suggest improvements, connections, and additional ideas
                </p>
              </div>
            </div>

            <div id="ai-suggestions-section" style="display: none; padding: 16px; background: rgba(168, 85, 247, 0.1); border-radius: 8px; border: 2px dashed rgba(168, 85, 247, 0.5);">
              <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600; color: #9333ea; display: flex; align-items: center; gap: 8px;">
                ✨ AI Suggestions
              </h3>
              <div id="ai-suggestions-list" style="max-height: 400px; overflow-y: auto;"></div>
            </div>
          </div>

          <div id="ai-results" style="flex: 1; min-width: 0; display: none; flex-direction: column; margin-top: -10px;">
            <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Generated Ideas</h3>
            <div id="ai-ideas-list" style="flex: 1; max-height: 750px; overflow-y: auto; padding: 12px; background: rgba(255, 255, 255, 0.3); border-radius: 8px;"></div>
          </div>
        </div>

        <div id="ai-loading" style="display: none; margin-bottom: 16px; padding: 16px; background: rgba(255, 255, 255, 0.5); border-radius: 8px; text-align: center;">
          <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid var(--color-outline); border-top-color: var(--color-accent-blue); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: var(--color-text-secondary);">AI is analyzing your notes...</p>
        </div>

        <div style="margin-bottom: 16px;">
          <label for="ai-suggestions-toggle" style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="ai-suggestions-toggle" checked>
            <span style="font-size: 14px; font-weight: 500;">Generate AI Suggestions</span>
          </label>
          <p style="margin: 4px 0 0 24px; font-size: 12px; color: var(--color-text-secondary);">
            AI will suggest improvements, connections, and additional ideas
          </p>
        </div>

        <div id="ai-loading" style="display: none; margin-bottom: 16px; padding: 16px; background: rgba(255, 255, 255, 0.5); border-radius: 8px; text-align: center;">
          <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid var(--color-outline); border-top-color: var(--color-accent-blue); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: var(--color-text-secondary);">AI is analyzing your notes...</p>
        </div>

        <div id="ai-results" style="display: none; margin-bottom: 16px;">
          <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Generated Ideas</h3>
          <div id="ai-ideas-list" style="max-height: 400px; overflow-y: auto; padding: 12px; background: rgba(255, 255, 255, 0.3); border-radius: 8px;"></div>
        </div>

        <div id="ai-error" style="display: none; margin-bottom: 16px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 4px solid #ef4444;">
          <p style="margin: 0; font-size: 14px; color: #dc2626;" id="ai-error-message"></p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-ai-import">Cancel</button>
          <button class="primary" id="generate-ideas">Generate Ideas</button>
          <button class="primary" id="import-ideas" style="display: none;">Import Ideas</button>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .ai-idea-item {
        padding: 12px;
        margin-bottom: 12px;
        background: var(--color-surface);
        border-radius: 8px;
        border: 1px solid var(--color-outline);
      }
      .ai-idea-title {
        font-family: var(--font-heading);
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .ai-idea-summary {
        font-size: 13px;
        color: var(--color-text-secondary);
        margin-bottom: 8px;
      }
      .ai-idea-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 12px;
      }
      .ai-idea-meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .ai-idea-relationships {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--color-outline);
        font-size: 12px;
      }
      .ai-idea-relationships strong {
        color: var(--color-text-secondary);
      }
    </style>
  `;

  document.getElementById('cancel-ai-import').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('generate-ideas').addEventListener('click', async () => {
    const apiKey = document.getElementById('ai-api-key').value.trim();
    const notes = document.getElementById('ai-notes').value.trim();
    const includeSuggestions = document.getElementById('ai-suggestions-toggle').checked;

    if (!apiKey) {
      showError('Please enter your Tensorix API key');
      return;
    }

    if (!notes) {
      showError('Please paste your meeting notes');
      return;
    }

    state.setAIApiKey(apiKey);

    const loadingEl = document.getElementById('ai-loading');
    const resultsEl = document.getElementById('ai-results');
    const errorEl = document.getElementById('ai-error');
    const generateBtn = document.getElementById('generate-ideas');

    loadingEl.style.display = 'block';
    resultsEl.style.display = 'none';
    errorEl.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      const { createAIService } = await import('../services/ai_service.js');
      const aiService = createAIService({
        provider: 'tensorix',
        apiKey: apiKey,
        model: 'z-ai/glm-4.7'
      });

      const response = await aiService.generateIdeasFromNotes(notes, includeSuggestions);
      generatedIdeas = response.ideas || [];
      generatedSuggestions = response.suggestions || [];

      console.log('Generated Ideas:', generatedIdeas);
      console.log('AI Suggestions:', generatedSuggestions);

      if (generatedIdeas.length === 0) {
        showError('No ideas were generated. Please try with more detailed notes.');
        return;
      }

      // Validate generated ideas structure
      const invalidIdeas = generatedIdeas.filter(idea => !idea.title);
      if (invalidIdeas.length > 0) {
        console.error('Invalid ideas generated:', invalidIdeas);
        showError('Some generated ideas are missing required fields. Please try again.');
        return;
      }

      displayGeneratedIdeas(generatedIdeas, generatedSuggestions);
      resultsEl.style.display = 'flex';
      document.getElementById('ai-suggestions-section').style.display = 'block';
      generateBtn.style.display = 'none';
      document.getElementById('import-ideas').style.display = 'inline-block';

    } catch (error) {
      console.error('AI Import Error:', error);
      showError(error.message || 'Failed to generate ideas. Please check your API key and try again.');
    } finally {
      loadingEl.style.display = 'none';
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Ideas';
    }
  });

  document.getElementById('import-ideas').addEventListener('click', async () => {
    try {
      const { resetCanvasState } = await import('./canvas.js');
      resetCanvasState();
      
      await state.importIdeasFromAI(generatedIdeas);
      state.setCurrentView('canvas');
      container.innerHTML = '';
      
      setTimeout(async () => {
        const { autoFitCanvas } = await import('./canvas.js');
        autoFitCanvas(state);
      }, 100);
    } catch (error) {
      showError(error.message || 'Failed to import ideas');
    }
  });

  function showError(message) {
    const errorEl = document.getElementById('ai-error');
    const errorMessageEl = document.getElementById('ai-error-message');
    errorMessageEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function displayGeneratedIdeas(ideas, suggestions = []) {
    const listEl = document.getElementById('ai-ideas-list');
    const suggestionsEl = document.getElementById('ai-suggestions-list');

    let html = '';

    if (ideas.length > 0) {
      html += ideas.map((idea, index) => `
        <div class="ai-idea-item">
          <div class="ai-idea-title">${index + 1}. ${escapeHtml(idea.title)}</div>
          <div class="ai-idea-summary">${escapeHtml(idea.summary || 'No summary')}</div>
          <div class="ai-idea-meta">
            <div class="ai-idea-meta-item">
              <span>Confidence: ${idea.confidence || 50}%</span>
            </div>
            <div class="ai-idea-meta-item">
              <span>Status: ${idea.status || 'New'}</span>
            </div>
            <div class="ai-idea-meta-item">
              <span>Color: ${idea.color_variant || 'primary'}</span>
            </div>
          </div>
          ${idea.tags && idea.tags.length > 0 ? `
            <div style="margin-top: 8px; font-size: 12px;">
              <strong>Tags:</strong> ${idea.tags.map(tag => `<span style="display: inline-block; padding: 2px 8px; margin: 2px; background: rgba(0,0,0,0.05); border-radius: 10px;">${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          ${idea.parent || (idea.related_to && idea.related_to.length > 0) ? `
            <div class="ai-idea-relationships">
              ${idea.parent ? `<div><strong>Parent:</strong> ${escapeHtml(idea.parent)}</div>` : ''}
              ${idea.related_to && idea.related_to.length > 0 ? `<div><strong>Related to:</strong> ${idea.related_to.map(r => escapeHtml(r)).join(', ')}</div>` : ''}
            </div>
          ` : ''}
        </div>
      `).join('');
    }

    listEl.innerHTML = html;

    if (suggestions.length > 0) {
      let suggestionsHtml = suggestions.map((suggestion, index) => `
        <div class="ai-suggestion-item suggestion-type-${suggestion.type}" style="padding: 12px; margin-bottom: 12px; background: rgba(255, 255, 255, 0.5); border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.3);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="suggestion-type-badge" style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${getSuggestionTypeLabel(suggestion.type)}</span>
            <span style="font-size: 12px; color: var(--color-text-secondary);">✨</span>
          </div>
          <div style="margin-bottom: 8px;">
            ${suggestion.type === 'new_idea' ? `
              <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(suggestion.title)}</div>
              <div style="font-size: 13px;">${escapeHtml(suggestion.summary)}</div>
            ` : `
              <div style="font-size: 13px;">${escapeHtml(suggestion.suggestion)}</div>
            `}
          </div>
          ${suggestion.reason ? `
            <div style="font-size: 12px; color: var(--color-text-secondary); font-style: italic; margin-bottom: 8px;">
              Why: ${escapeHtml(suggestion.reason)}
            </div>
          ` : ''}
            <div style="display: flex; gap: 8px;">
              <button class="ai-suggestion-btn accept" data-suggestion-index="${index}" style="padding: 6px 12px; border-radius: 4px; border: none; background: #10b981; color: white; cursor: pointer; font-size: 12px;">Accept</button>
              <button class="ai-suggestion-btn dismiss" data-suggestion-index="${index}" style="padding: 6px 12px; border-radius: 4px; border: none; background: #ef4444; color: white; cursor: pointer; font-size: 12px;">Dismiss</button>
            </div>
        </div>
      `).join('');
      suggestionsEl.innerHTML = suggestionsHtml;

      suggestionsEl.querySelectorAll('.ai-suggestion-btn.accept').forEach(btn => {
        btn.addEventListener('click', () => acceptSuggestion(parseInt(btn.dataset.suggestionIndex)));
      });

      suggestionsEl.querySelectorAll('.ai-suggestion-btn.dismiss').forEach(btn => {
        btn.addEventListener('click', () => dismissSuggestion(parseInt(btn.dataset.suggestionIndex)));
      });
    } else {
      suggestionsEl.innerHTML = '<p style="color: var(--color-text-secondary); font-size: 13px;">No suggestions generated.</p>';
    }
  }

  function getSuggestionTypeLabel(type) {
    const labels = {
      improvement: '💡 Improvement',
      connection: '🔗 Connection',
      new_idea: '✨ New Idea',
      merge: '🔄 Merge'
    };
    return labels[type] || type;
  }

  function acceptSuggestion(index) {
    const suggestion = generatedSuggestions[index];
    if (!suggestion) return;

    console.log('Accepting suggestion:', suggestion);

    if (suggestion.type === 'new_idea') {
      generatedIdeas.push({
        ...suggestion,
        is_ai_suggestion: true,
        suggestion_type: suggestion.type,
        suggestion_reason: suggestion.reason
      });
    } else if (suggestion.type === 'connection') {
      const fromIdea = generatedIdeas.find(i => i.title === suggestion.from_idea);
      const toIdea = generatedIdeas.find(i => i.title === suggestion.to_idea);
      if (fromIdea && toIdea) {
        if (!fromIdea.related_to) fromIdea.related_to = [];
        fromIdea.related_to.push(suggestion.to_idea);
      }
    } else if (suggestion.type === 'improvement') {
      const targetIdea = generatedIdeas.find(i => i.title === suggestion.target_idea);
      if (targetIdea) {
        if (!targetIdea.why_interesting) targetIdea.why_interesting = '';
        targetIdea.why_interesting += `\n\nAI Suggestion: ${suggestion.suggestion}\nReason: ${suggestion.reason}`;
      }
    }

    generatedSuggestions.splice(index, 1);
    displayGeneratedIdeas(generatedIdeas, generatedSuggestions);
  }

  function dismissSuggestion(index) {
    generatedSuggestions.splice(index, 1);
    displayGeneratedIdeas(generatedIdeas, generatedSuggestions);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
