import { appState } from './state.js';
import { renderSidebar } from '../ui/sidebar.js';
import { renderIdeaDetail } from '../ui/idea_detail.js';
import { renderCanvas } from '../ui/canvas.js';
import { showReviewModal } from '../ui/review_modal.js';
import { showAIImportDialog } from '../ui/ai_import.js';
import { exportToPideas, exportToMarkdown, importFromPideas, showImportDialog } from '../utils/export_import.js';
import { bulkSaveIdeas } from '../db/idb.js';
import { generateUUID } from '../utils/uuid.js';
import { renderSearchBox, renderSearchResults, setupSearchEventListeners } from '../ui/search.js';

let dueCheckInterval = null;

export async function initApp() {
  await appState.init();
  setupEventListeners();
  startDueCheck();
  render();
  appState.subscribe(render);
}

initApp().catch(error => {
  console.error('Init app error:', error);
});

function setupEventListeners() {
  const searchBox = document.getElementById('search-box');
  const createIdeaBtn = document.getElementById('create-idea-btn');
  const aiImportBtn = document.getElementById('ai-import-btn');
  const quickAddInput = document.getElementById('quick-add-input');
  const quickAddBtn = document.getElementById('quick-add-btn');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const clearCanvasBtn = document.getElementById('clear-canvas-btn');
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

  if (aiImportBtn) {
    aiImportBtn.addEventListener('click', () => {
      showAIImportDialog(appState);
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

  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', () => {
      showClearCanvasDialog();
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

function showClearCanvasDialog() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const ideaCount = appState.ideas.filter(i => !i.is_archived).length;

  container.innerHTML = `
    <div class="modal-overlay" id="clear-canvas-modal">
      <div class="modal-content" style="max-width: 450px;">
        <h2 style="margin-bottom: 16px;">Clear Canvas</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 16px;">
          Are you sure you want to clear the canvas? This will delete all <strong>${ideaCount}</strong> idea(s).
        </p>
        <p style="color: #dc2626; margin-bottom: 24px; font-size: 14px;">
          Warning: This action cannot be undone. All ideas will be permanently deleted.
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-clear">Cancel</button>
          <button class="primary" id="confirm-clear" style="background-color: #dc2626; border-color: #dc2626;">Clear All Ideas</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-clear').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('confirm-clear').addEventListener('click', async () => {
    try {
      await appState.clearAllIdeas();
      container.innerHTML = '';
    } catch (error) {
      alert('Failed to clear canvas: ' + error.message);
    }
  });
}

function showSettingsDialog() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="settings-modal">
      <div class="modal-content" style="max-width: 500px;">
        <h2 style="margin-bottom: 16px;">Settings</h2>

        <div style="margin-bottom: 16px;">
          <label for="setting-float" style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="setting-float" ${appState.settings.bubbleFloat ? 'checked' : ''}>
            <span style="font-size: 14px; font-weight: 500;">Bubble Float Animation</span>
          </label>
        </div>

        <div style="margin-bottom: 16px;">
          <label for="setting-glassy" style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="setting-glassy" ${appState.settings.glassyAesthetic ? 'checked' : ''}>
            <span style="font-size: 14px; font-weight: 500;">Glassy Aesthetic</span>
          </label>
        </div>

        <div style="margin-bottom: 16px;">
          <label for="setting-cadence" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Default Review Cadence (days)</label>
          <input type="number" id="setting-cadence" value="${appState.settings.defaultReviewCadence}" min="1" max="365" style="width: 100%;">
        </div>

        <div style="margin-bottom: 16px; padding-top: 16px; border-top: 1px solid var(--color-outline);">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">🤖 AI Settings</h3>
          <div style="margin-bottom: 12px;">
            <label for="setting-ai-key" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">
              Tensorix API Key
              <span style="font-weight: normal; color: var(--color-text-secondary); font-size: 12px;">
                (Get one at <a href="https://tensorix.ai" target="_blank" style="color: var(--color-accent-blue);">tensorix.ai</a>)
              </span>
            </label>
            <input
              type="password"
              id="setting-ai-key"
              value="${appState.settings.aiApiKey || ''}"
              placeholder="sk-..."
              style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-outline); font-family: monospace;"
            />
            <p style="margin-top: 6px; font-size: 12px; color: var(--color-text-secondary);">
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>
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
      bubbleFloat: document.getElementById('setting-float').checked,
      glassyAesthetic: document.getElementById('setting-glassy').checked,
      defaultReviewCadence: parseInt(document.getElementById('setting-cadence').value),
      aiApiKey: document.getElementById('setting-ai-key').value.trim()
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

function applyGlassyMode() {
  if (appState.settings.glassyAesthetic) {
    document.body.classList.add('glassy-mode');
  } else {
    document.body.classList.remove('glassy-mode');
  }
}

function render() {
  applyGlassyMode();
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
