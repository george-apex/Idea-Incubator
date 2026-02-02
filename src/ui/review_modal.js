import { getRandomPrompts, getPromptSetId } from '../utils/prompts.js';
import { calculateSuggestedConfidence } from '../utils/confidence.js';

let currentReviewIdea = null;
let currentPrompts = [];
let reviewCallback = null;

export function showReviewModal(idea, onSubmit, onSnooze, onArchive) {
  currentReviewIdea = idea;
  currentPrompts = getRandomPrompts(4);
  reviewCallback = onSubmit;

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="review-modal">
      <div class="modal-content">
        <h2 style="margin-bottom: 8px;">Review Required</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
          "${escapeHtml(idea.title || 'Untitled Idea')}" is due for review. Please answer the prompts below.
        </p>
        
        <form id="review-form">
          <div id="review-prompts" style="margin-bottom: 24px;">
            ${currentPrompts.map(prompt => renderPrompt(prompt)).join('')}
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Notes (optional)</label>
            <textarea id="review-notes" class="inline-edit textarea" placeholder="Any additional thoughts..." style="width: 100%;"></textarea>
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Update Status (optional)</label>
            <select id="review-status" style="width: 100%;">
              <option value="">Keep current status</option>
              <option value="Incubating">Incubating</option>
              <option value="Exploring">Exploring</option>
              <option value="Validating">Validating</option>
              <option value="Building">Building</option>
              <option value="Shipped">Shipped</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
          
          <div id="confidence-section" style="margin-bottom: 24px; padding: 16px; border-radius: var(--bubble-radius); background: var(--color-surface);">
            <label for="review-confidence" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Confidence</label>
            <div style="display: flex; align-items: center; gap: 16px;">
              <input type="range" id="review-confidence" min="0" max="100" value="${idea.confidence}" style="flex: 1;">
              <span id="review-confidence-value" style="font-size: 18px; font-weight: 600; color: var(--color-accent-blue); min-width: 50px; text-align: right;">${idea.confidence}%</span>
            </div>
            <p id="confidence-suggestion" style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;"></p>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="secondary" id="snooze-btn">Snooze</button>
            <button type="button" class="secondary" id="archive-btn">Archive</button>
            <button type="submit" class="primary">Submit Review</button>
          </div>
        </form>
      </div>
    </div>
  `;

  attachReviewModalListeners(idea, onSubmit, onSnooze, onArchive);
}

function renderPrompt(prompt) {
  if (prompt.type === 'choice') {
    return `
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">${escapeHtml(prompt.text)}</label>
        <select name="prompt_${prompt.id}" required style="width: 100%;">
          <option value="">Select an option...</option>
          ${prompt.options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
        </select>
      </div>
    `;
  } else {
    return `
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">${escapeHtml(prompt.text)}</label>
        <textarea name="prompt_${prompt.id}" required class="inline-edit textarea" style="width: 100%; min-height: 60px;" placeholder="Your answer..."></textarea>
      </div>
    `;
  }
}

function attachReviewModalListeners(idea, onSubmit, onSnooze, onArchive) {
  const form = document.getElementById('review-form');
  const confidenceSlider = document.getElementById('review-confidence');
  const confidenceValue = document.getElementById('review-confidence-value');
  const snoozeBtn = document.getElementById('snooze-btn');
  const archiveBtn = document.getElementById('archive-btn');

  const updateConfidenceSuggestion = () => {
    const formData = new FormData(form);
    const answers = {};
    
    currentPrompts.forEach(prompt => {
      answers[prompt.id] = formData.get(`prompt_${prompt.id}`) || '';
    });

    const suggestion = calculateSuggestedConfidence(idea, { answers });
    confidenceSlider.value = suggestion.suggested;
    confidenceValue.textContent = suggestion.suggested + '%';
    
    const suggestionText = document.getElementById('confidence-suggestion');
    if (suggestion.delta !== 0) {
      suggestionText.textContent = `Suggested: ${suggestion.suggested}% (${suggestion.delta > 0 ? '+' : ''}${suggestion.delta})`;
    } else {
      suggestionText.textContent = 'Suggested: ' + suggestion.suggested + '%';
    }
  };

  if (confidenceSlider) {
    confidenceSlider.addEventListener('input', (e) => {
      confidenceValue.textContent = e.target.value + '%';
    });
  }

  form.addEventListener('input', updateConfidenceSuggestion);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const answers = {};
      
      currentPrompts.forEach(prompt => {
        answers[prompt.id] = formData.get(`prompt_${prompt.id}`) || '';
      });

      const reviewData = {
        answers,
        confidence_after: parseInt(confidenceSlider.value),
        user_adjusted: true,
        notes: document.getElementById('review-notes').value,
        new_status: document.getElementById('review-status').value || null,
        next_step: answers.next_step || null
      };

      await onSubmit(idea.id, reviewData);
      closeModal();
    });
  }

  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', () => {
      showSnoozeDialog(onSnooze);
    });
  }

  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      if (confirm('Archive this idea?')) {
        onArchive(idea.id);
        closeModal();
      }
    });
  }

  updateConfidenceSuggestion();
}

function showSnoozeDialog(onSnooze) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="snooze-modal">
      <div class="modal-content" style="max-width: 400px;">
        <h2 style="margin-bottom: 16px;">Snooze Review</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
          How long would you like to snooze this idea?
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="secondary snooze-option" data-days="1">1 day</button>
          <button class="secondary snooze-option" data-days="3">3 days</button>
          <button class="secondary snooze-option" data-days="7">7 days</button>
          <button class="secondary" id="cancel-snooze">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.snooze-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days);
      onSnooze(currentReviewIdea.id, days);
      closeModal();
    });
  });

  document.getElementById('cancel-snooze').addEventListener('click', () => {
    showReviewModal(currentReviewIdea, reviewCallback);
  });
}

function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) {
    container.innerHTML = '';
  }
  currentReviewIdea = null;
  currentPrompts = [];
  reviewCallback = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
