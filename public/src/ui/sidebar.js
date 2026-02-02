import { isIdeaDue, getStaleDays } from '../models/idea.js';

export function renderSidebar(state) {
  const container = document.getElementById('sidebar');
  if (!container) return;

  const filteredIdeas = state.getFilteredIdeas();
  const categories = state.getCategories();
  const statuses = state.getStatuses();

  container.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-filters">
        <div class="filter-group">
          <label class="filter-label">Status</label>
          <select class="filter-select" id="filter-status">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
            ${statuses.map(status => `
              <option value="${status}" ${state.filterStatus === status ? 'selected' : ''}>${status}</option>
            `).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Category</label>
          <select class="filter-select" id="filter-category">
            <option value="all" ${state.filterCategory === 'all' ? 'selected' : ''}>All Categories</option>
            ${categories.map(cat => `
              <option value="${cat}" ${state.filterCategory === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">
            <input type="checkbox" id="filter-due" ${state.filterDueOnly ? 'checked' : ''}>
            Due Only
          </label>
        </div>
        <div class="filter-group">
          <label class="filter-label">
            <input type="checkbox" id="filter-archived" ${state.filterArchived ? 'checked' : ''}>
            Show Archived
          </label>
        </div>
      </div>
    </div>
    <div class="sidebar-list scrollbar-thin" id="idea-list">
      ${filteredIdeas.length === 0 ? `
        <div style="padding: 24px; text-align: center; color: var(--color-text-secondary);">
          No ideas found
        </div>
      ` : filteredIdeas.map(idea => renderIdeaListItem(idea, state)).join('')}
    </div>
  `;

  attachSidebarListeners(state);
}

function renderIdeaListItem(idea, state) {
  const isDue = isIdeaDue(idea);
  const staleDays = getStaleDays(idea);
  const isActive = state.selectedIdeaId === idea.id;

  return `
    <div class="idea-list-item ${isActive ? 'active' : ''} ${isDue ? 'due' : ''}" data-id="${idea.id}">
      <div class="idea-list-item-title">${escapeHtml(idea.title || 'Untitled Idea')}</div>
      <div class="idea-list-item-meta">
        <span class="status-pill">${escapeHtml(idea.status)}</span>
        ${staleDays > 7 ? `<span class="stale-badge">⏳ ${staleDays}d</span>` : ''}
        ${isDue ? '<span class="due-indicator"></span>' : ''}
      </div>
    </div>
  `;
}

function attachSidebarListeners(state) {
  const filterStatus = document.getElementById('filter-status');
  const filterCategory = document.getElementById('filter-category');
  const filterDue = document.getElementById('filter-due');
  const filterArchived = document.getElementById('filter-archived');
  const ideaList = document.getElementById('idea-list');

  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      state.setFilterStatus(e.target.value);
    });
  }

  if (filterCategory) {
    filterCategory.addEventListener('change', (e) => {
      state.setFilterCategory(e.target.value);
    });
  }

  if (filterDue) {
    filterDue.addEventListener('change', (e) => {
      state.setFilterDueOnly(e.target.checked);
    });
  }

  if (filterArchived) {
    filterArchived.addEventListener('change', (e) => {
      state.setFilterArchived(e.target.checked);
    });
  }

  if (ideaList) {
    ideaList.addEventListener('click', (e) => {
      const item = e.target.closest('.idea-list-item');
      if (item) {
        const ideaId = item.dataset.id;
        state.setSelectedIdeaId(ideaId);
      }
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
