import { appState } from './state.js';
import { renderSidebar } from '../ui/sidebar.js';
import { renderIdeaDetail } from '../ui/idea_detail.js';
import { renderCanvas } from '../ui/canvas.js';
import { showReviewModal } from '../ui/review_modal.js';
import { exportToPideas, exportToMarkdown, importFromPideas, showImportDialog } from '../utils/export_import.js';
import { bulkSaveIdeas } from '../db/idb.js';
import { generateUUID } from '../utils/uuid.js';

let dueCheckInterval = null;

export async function initApp() {
  await appState.init();
  
  setupEventListeners();
  startDueCheck();
  render();
  
  appState.subscribe(render);
}

function setupEventListeners() {
  const searchBox = document.getElementById('search-box');
  const createIdeaBtn = document.getElementById('create-idea-btn');
  const quickAddInput = document.getElementById('quick-add-input');
  const quickAddBtn = document.getElementById('quick-add-btn');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const dueCounter = document.getElementById('due-counter');

  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      appState.setSearchQuery(e.target.value);
    });
  }

  if (createIdeaBtn) {
    createIdeaBtn.addEventListener('click', () => {
      appState.createIdea({ title: 'New Idea' });
    });
  }

  if (quickAddInput && quickAddBtn) {
    const handleQuickAdd = async () => {
      const title = quickAddInput.value.trim();
      if (title) {
        await appState.createIdea({ title });
        quickAddInput.value = '';
      }
    };

    quickAddBtn.addEventListener('click', handleQuickAdd);
    quickAddInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleQuickAdd();
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      showExportDialog();
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pideas';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const data = await importFromPideas(file);
            showImportDialog(data, handleImport);
          } catch (error) {
            alert('Failed to import file: ' + error.message);
          }
        }
      };
      input.click();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      showSettingsDialog();
    });
  }

  if (dueCounter) {
    dueCounter.addEventListener('click', () => {
      appState.setFilterDueOnly(true);
      appState.setCurrentView('canvas');
    });
  }
}

function showExportDialog() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="export-modal">
      <div class="modal-content" style="max-width: 400px;">
        <h2 style="margin-bottom: 16px;">Export Ideas</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
          Choose export format:
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="primary" id="export-pideas">Export as .pideas (re-importable)</button>
          <button class="secondary" id="export-md">Export as Markdown (readable)</button>
          <button class="secondary" id="cancel-export">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('export-pideas').addEventListener('click', async () => {
    await exportToPideas(appState.ideas, appState.settings);
    container.innerHTML = '';
  });

  document.getElementById('export-md').addEventListener('click', async () => {
    await exportToMarkdown(appState.ideas);
    container.innerHTML = '';
  });

  document.getElementById('cancel-export').addEventListener('click', () => {
    container.innerHTML = '';
  });
}

async function handleImport(data, resolution) {
  const ideasToImport = [];

  for (const idea of data.ideas) {
    const existing = appState.ideas.find(i => i.id === idea.id);
    
    if (existing) {
      if (resolution === 'skip') {
        continue;
      } else if (resolution === 'overwrite') {
        ideasToImport.push(idea);
      } else if (resolution === 'duplicate') {
        const duplicate = { ...idea, id: generateUUID() };
        ideasToImport.push(duplicate);
      }
    } else {
      ideasToImport.push(idea);
    }
  }

  await bulkSaveIdeas(ideasToImport);
  appState.ideas.push(...ideasToImport);
  appState.notify();
  
  alert(`Imported ${ideasToImport.length} idea(s)`);
}

function showSettingsDialog() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="settings-modal">
      <div class="modal-content" style="max-width: 500px;">
        <h2 style="margin-bottom: 16px;">Settings</h2>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Theme Intensity</label>
          <select id="setting-theme" style="width: 100%;">
            <option value="calm" ${appState.settings.themeIntensity === 'calm' ? 'selected' : ''}>Calm</option>
            <option value="normal" ${appState.settings.themeIntensity === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="high" ${appState.settings.themeIntensity === 'high' ? 'selected' : ''}>High Contrast</option>
          </select>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="setting-float" ${appState.settings.bubbleFloat ? 'checked' : ''}>
            <span style="font-size: 14px; font-weight: 500;">Bubble Float Animation</span>
          </label>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label for="setting-cadence" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Default Review Cadence (days)</label>
          <input type="number" id="setting-cadence" value="${appState.settings.defaultReviewCadence}" min="1" max="365" style="width: 100%;">
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-settings">Cancel</button>
          <button class="primary" id="save-settings">Save</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-settings').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('save-settings').addEventListener('click', async () => {
    const newSettings = {
      themeIntensity: document.getElementById('setting-theme').value,
      bubbleFloat: document.getElementById('setting-float').checked,
      defaultReviewCadence: parseInt(document.getElementById('setting-cadence').value)
    };
    
    await appState.updateSettings(newSettings);
    container.innerHTML = '';
  });
}

function startDueCheck() {
  const checkDue = async () => {
    await appState.refreshDueIdeas();
    updateDueCounter();
  };

  checkDue();
  dueCheckInterval = setInterval(checkDue, 10 * 60 * 1000);
}

function updateDueCounter() {
  const dueCounter = document.getElementById('due-counter');
  if (!dueCounter) return;

  const count = appState.dueIdeas.length;
  dueCounter.textContent = `${count} Due`;
  
  if (count === 0) {
    dueCounter.classList.add('zero');
  } else {
    dueCounter.classList.remove('zero');
  }
}

function render() {
  renderSidebar(appState);
  
  const mainPanel = document.getElementById('main-panel');
  if (!mainPanel) return;

  if (appState.currentView === 'canvas') {
    renderCanvas(appState);
  } else {
    renderIdeaDetail(appState);
  }

  updateDueCounter();
}

export function showReviewForIdea(ideaId) {
  const idea = appState.ideas.find(i => i.id === ideaId);
  if (idea) {
    showReviewModal(
      idea,
      (id, data) => appState.submitReview(id, data),
      (id, days) => appState.snoozeIdea(id, days),
      (id) => appState.archiveIdea(id)
    );
  }
}

initApp();
