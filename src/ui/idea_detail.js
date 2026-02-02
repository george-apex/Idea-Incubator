import { createAssumption, createOpenQuestion, createNextStep, COLOR_VARIANTS } from '../models/idea.js';

export function renderIdeaDetail(state) {
  const container = document.getElementById('main-panel');
  if (!container) return;

  const idea = state.getSelectedIdea();
  if (!idea) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary);">
        <div style="text-align: center;">
          <h2 style="margin-bottom: 16px;">No idea selected</h2>
          <p>Select an idea from the sidebar or create a new one</p>
        </div>
      </div>
    `;
    return;
  }

  const statuses = state.getStatuses();
  const categories = state.getCategories();

  container.innerHTML = `
    <div class="panel-header">
      <div class="panel-tabs">
        <button class="panel-tab active" data-view="detail">Detail</button>
        <button class="panel-tab" data-view="canvas">Canvas</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="secondary" id="archive-btn">${idea.is_archived ? 'Unarchive' : 'Archive'}</button>
        <button class="danger" id="delete-btn">Delete</button>
      </div>
    </div>
    <div class="panel-content">
      <div class="idea-detail scrollbar-thin">
        ${renderOverviewSection(idea, statuses, categories, COLOR_VARIANTS)}
        ${renderAssumptionsSection(idea)}
        ${renderOpenQuestionsSection(idea)}
        ${renderNextStepsSection(idea)}
        ${renderReviewHistorySection(idea)}
        ${renderLinksSection(idea, state)}
      </div>
    </div>
  `;

  attachIdeaDetailListeners(state, idea);
}

function renderOverviewSection(idea, statuses, categories, colorVariants) {
  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Overview</h3>
      </div>
      <div class="detail-section-content">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Title</label>
          <input class="inline-edit" id="idea-title" value="${escapeHtml(idea.title)}" placeholder="Idea title...">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Summary</label>
          <textarea class="inline-edit textarea" id="idea-summary" placeholder="Brief summary...">${escapeHtml(idea.summary)}</textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Problem</label>
          <textarea class="inline-edit textarea" id="idea-problem" placeholder="What problem does this solve?">${escapeHtml(idea.problem)}</textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Why Interesting</label>
          <textarea class="inline-edit textarea" id="idea-why" placeholder="Why is this interesting?">${escapeHtml(idea.why_interesting)}</textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Status</label>
            <select class="inline-edit" id="idea-status">
              ${statuses.map(status => `
                <option value="${status}" ${idea.status === status ? 'selected' : ''}>${status}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Category</label>
            <input class="inline-edit" id="idea-category" value="${escapeHtml(idea.category)}" placeholder="Category..." list="categories">
            <datalist id="categories">
              ${categories.map(cat => `<option value="${escapeHtml(cat)}">`).join('')}
            </datalist>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Tags</label>
          <input class="inline-edit" id="idea-tags" value="${escapeHtml(idea.tags.join(', '))}" placeholder="tag1, tag2, tag3...">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Color Variant</label>
          <select class="inline-edit" id="idea-color">
            ${colorVariants.map(variant => `
              <option value="${variant}" ${idea.color_variant === variant ? 'selected' : ''}>${variant}</option>
            `).join('')}
          </select>
        </div>
        <div class="confidence-slider-container">
          <label for="idea-confidence" style="font-size: 14px; font-weight: 500; color: var(--color-text-secondary);">Confidence</label>
          <input type="range" class="confidence-slider" id="idea-confidence" min="0" max="100" value="${idea.confidence}">
          <span class="confidence-value" id="confidence-display">${idea.confidence}%</span>
        </div>
      </div>
    </div>
  `;
}

function renderAssumptionsSection(idea) {
  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Assumptions</h3>
        <button class="secondary" id="add-assumption">+ Add</button>
      </div>
      <div class="detail-section-content">
        ${idea.assumptions.length === 0 ? `
          <p style="color: var(--color-text-secondary); font-style: italic;">No assumptions yet</p>
        ` : idea.assumptions.map((assumption, index) => `
          <div style="padding: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.5); margin-bottom: 8px;">
            <input class="inline-edit" data-field="assumptions" data-index="${index}" data-subfield="text" value="${escapeHtml(assumption.text)}" placeholder="Assumption...">
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <select class="inline-edit" data-field="assumptions" data-index="${index}" data-subfield="confidence" style="flex: 1;">
                <option value="low" ${assumption.confidence === 'low' ? 'selected' : ''}>Low Confidence</option>
                <option value="medium" ${assumption.confidence === 'medium' ? 'selected' : ''}>Medium Confidence</option>
                <option value="high" ${assumption.confidence === 'high' ? 'selected' : ''}>High Confidence</option>
              </select>
              <select class="inline-edit" data-field="assumptions" data-index="${index}" data-subfield="status" style="flex: 1;">
                <option value="active" ${assumption.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="invalidated" ${assumption.status === 'invalidated' ? 'selected' : ''}>Invalidated</option>
                <option value="confirmed" ${assumption.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              </select>
              <button class="danger" data-delete-assumption="${index}" style="padding: 8px 12px;">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderOpenQuestionsSection(idea) {
  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Open Questions</h3>
        <button class="secondary" id="add-question">+ Add</button>
      </div>
      <div class="detail-section-content">
        ${idea.open_questions.length === 0 ? `
          <p style="color: var(--color-text-secondary); font-style: italic;">No questions yet</p>
        ` : idea.open_questions.map((question, index) => `
          <div style="padding: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.5); margin-bottom: 8px;">
            <input class="inline-edit" data-field="open_questions" data-index="${index}" data-subfield="text" value="${escapeHtml(question.text)}" placeholder="Question...">
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <select class="inline-edit" data-field="open_questions" data-index="${index}" data-subfield="status" style="flex: 1;">
                <option value="open" ${question.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="resolved" ${question.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                <option value="deferred" ${question.status === 'deferred' ? 'selected' : ''}>Deferred</option>
              </select>
              <button class="danger" data-delete-question="${index}" style="padding: 8px 12px;">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderNextStepsSection(idea) {
  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Next Steps</h3>
        <button class="secondary" id="add-next-step">+ Add</button>
      </div>
      <div class="detail-section-content">
        ${idea.next_steps.length === 0 ? `
          <p style="color: var(--color-text-secondary); font-style: italic;">No next steps yet</p>
        ` : idea.next_steps.map((step, index) => `
          <div style="padding: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.5); margin-bottom: 8px; display: flex; gap: 8px; align-items: center;">
            <input type="checkbox" data-field="next_steps" data-index="${index}" data-subfield="status" ${step.status === 'done' ? 'checked' : ''} style="flex-shrink: 0;">
            <input class="inline-edit" data-field="next_steps" data-index="${index}" data-subfield="text" value="${escapeHtml(step.text)}" placeholder="Next step..." style="flex: 1;">
            <button class="danger" data-delete-next-step="${index}" style="padding: 8px 12px;">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderReviewHistorySection(idea) {
  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Review History</h3>
      </div>
      <div class="detail-section-content">
        ${idea.reviews.length === 0 ? `
          <p style="color: var(--color-text-secondary); font-style: italic;">No reviews yet</p>
        ` : idea.reviews.slice().reverse().map(review => `
          <div style="padding: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.5); margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; color: var(--color-text-secondary);">${new Date(review.created_at).toLocaleDateString()}</span>
              <span style="font-size: 12px; font-weight: 500;">${review.confidence_before}% → ${review.confidence_after}%</span>
            </div>
            ${review.notes ? `<p style="font-size: 14px; margin-bottom: 8px;">${escapeHtml(review.notes)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderLinksSection(idea, state) {
  const linkedIdeas = idea.links.map(id => state.ideas.find(i => i.id === id)).filter(Boolean);
  const otherIdeas = state.ideas.filter(i => i.id !== idea.id && !idea.links.includes(i.id));

  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <h3 class="detail-section-title">Linked Ideas</h3>
      </div>
      <div class="detail-section-content">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;">Link Idea</label>
          <select id="link-idea-select" style="width: 100%;">
            <option value="">Select an idea to link...</option>
            ${otherIdeas.map(i => `<option value="${i.id}">${escapeHtml(i.title || 'Untitled')}</option>`).join('')}
          </select>
        </div>
        ${linkedIdeas.length === 0 ? `
          <p style="color: var(--color-text-secondary); font-style: italic;">No linked ideas</p>
        ` : `
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${linkedIdeas.map(linked => `
              <span class="status-pill" style="cursor: pointer;" data-link-id="${linked.id}">${escapeHtml(linked.title || 'Untitled')} ×</span>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function attachIdeaDetailListeners(state, idea) {
  const titleInput = document.getElementById('idea-title');
  const summaryInput = document.getElementById('idea-summary');
  const problemInput = document.getElementById('idea-problem');
  const whyInput = document.getElementById('idea-why');
  const statusSelect = document.getElementById('idea-status');
  const categoryInput = document.getElementById('idea-category');
  const tagsInput = document.getElementById('idea-tags');
  const colorSelect = document.getElementById('idea-color');
  const confidenceSlider = document.getElementById('idea-confidence');
  const archiveBtn = document.getElementById('archive-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const addAssumptionBtn = document.getElementById('add-assumption');
  const addQuestionBtn = document.getElementById('add-question');
  const addNextStepBtn = document.getElementById('add-next-step');
  const linkIdeaSelect = document.getElementById('link-idea-select');

  const autoSave = async () => {
    idea.title = titleInput.value;
    idea.summary = summaryInput.value;
    idea.problem = problemInput.value;
    idea.why_interesting = whyInput.value;
    idea.status = statusSelect.value;
    idea.category = categoryInput.value;
    idea.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    idea.color_variant = colorSelect.value;
    idea.confidence = parseInt(confidenceSlider.value);
    await state.updateIdea(idea);
    showToast('Saved');
  };

  [titleInput, summaryInput, problemInput, whyInput, statusSelect, categoryInput, tagsInput, colorSelect].forEach(input => {
    if (input) {
      input.addEventListener('blur', autoSave);
    }
  });

  if (confidenceSlider) {
    confidenceSlider.addEventListener('input', (e) => {
      document.getElementById('confidence-display').textContent = e.target.value + '%';
    });
    confidenceSlider.addEventListener('change', autoSave);
  }

  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      if (idea.is_archived) {
        await state.unarchiveIdea(idea.id);
      } else {
        await state.archiveIdea(idea.id);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this idea?')) {
        await state.deleteIdea(idea.id);
      }
    });
  }

  if (addAssumptionBtn) {
    addAssumptionBtn.addEventListener('click', async () => {
      idea.assumptions.push(createAssumption());
      await state.updateIdea(idea);
    });
  }

  if (addQuestionBtn) {
    addQuestionBtn.addEventListener('click', async () => {
      idea.open_questions.push(createOpenQuestion());
      await state.updateIdea(idea);
    });
  }

  if (addNextStepBtn) {
    addNextStepBtn.addEventListener('click', async () => {
      idea.next_steps.push(createNextStep());
      await state.updateIdea(idea);
    });
  }

  document.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const field = e.target.dataset.field;
      const index = parseInt(e.target.dataset.index);
      const subfield = e.target.dataset.subfield;

      if (field === 'assumptions') {
        if (subfield === 'text') {
          idea.assumptions[index].text = e.target.value;
        } else {
          idea.assumptions[index][subfield] = e.target.value;
        }
      } else if (field === 'open_questions') {
        idea.open_questions[index][subfield] = e.target.value;
      } else if (field === 'next_steps') {
        if (subfield === 'status') {
          idea.next_steps[index].status = e.target.checked ? 'done' : 'todo';
        } else {
          idea.next_steps[index][subfield] = e.target.value;
        }
      }
      await state.updateIdea(idea);
    });
  });

  document.querySelectorAll('[data-delete-assumption]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.deleteAssumption);
      idea.assumptions.splice(index, 1);
      await state.updateIdea(idea);
    });
  });

  document.querySelectorAll('[data-delete-question]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.deleteQuestion);
      idea.open_questions.splice(index, 1);
      await state.updateIdea(idea);
    });
  });

  document.querySelectorAll('[data-delete-next-step]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.deleteNextStep);
      idea.next_steps.splice(index, 1);
      await state.updateIdea(idea);
    });
  });

  if (linkIdeaSelect) {
    linkIdeaSelect.addEventListener('change', async (e) => {
      if (e.target.value) {
        idea.links.push(e.target.value);
        await state.updateIdea(idea);
      }
    });
  }

  document.querySelectorAll('[data-link-id]').forEach(el => {
    el.addEventListener('click', async () => {
      const linkId = el.dataset.linkId;
      idea.links = idea.links.filter(id => id !== linkId);
      await state.updateIdea(idea);
    });
  });

  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      state.setCurrentView(view);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}
