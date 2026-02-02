import { isIdeaDue } from '../models/idea.js';

let canvasState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  isPanning: false,
  dragStartX: 0,
  dragStartY: 0,
  panStartX: 0,
  panStartY: 0,
  draggedBubble: null,
  bubbleWasMoved: false,
  linkMode: false,
  linkSourceBubble: null,
  selectedLink: null,
  mergeMode: false,
  mergeSourceBubble: null
};

export function renderCanvas(state) {
  const container = document.getElementById('main-panel');
  if (!container) return;

  const ideas = state.getFilteredIdeas();

  container.innerHTML = `
    <div class="panel-header">
      <div class="panel-tabs">
        <button class="panel-tab" data-view="detail">Detail</button>
        <button class="panel-tab active" data-view="canvas">Canvas</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="secondary ${canvasState.linkMode ? 'active' : ''}" id="link-mode-btn">Link Mode</button>
        <button class="secondary ${canvasState.mergeMode ? 'active' : ''}" id="merge-mode-btn">Merge Mode</button>
        <button class="secondary" id="reset-view">Reset View</button>
      </div>
    </div>
    <div class="panel-content">
      <div class="bubble-canvas" id="bubble-canvas">
        <div class="canvas-container" id="canvas-container">
          <svg class="connection-lines" id="connection-lines" style="overflow: visible; position: absolute; top: -5000px; left: -5000px; width: 20000px; height: 20000px;">
            ${renderConnectionLines(ideas)}
          </svg>
          ${ideas.map(idea => renderBubble(idea, state)).join('')}
        </div>
        <div class="canvas-controls">
          <button class="canvas-control-btn" id="zoom-out">−</button>
          <span class="canvas-zoom-level" id="zoom-level">100%</span>
          <button class="canvas-control-btn" id="zoom-in">+</button>
        </div>
      </div>
    </div>
  `;

  attachCanvasListeners(state);
  
  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.style.transform = `translate(${canvasState.offsetX}px, ${canvasState.offsetY}px) scale(${canvasState.scale})`;
  }
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateConnectionLines(state);
    });
  });
}

function renderConnectionLines(ideas) {
  const lines = [];
  const processedLinks = new Set();

  ideas.forEach(idea => {
    if (idea.links && idea.links.length > 0) {
      idea.links.forEach(linkId => {
        const linkKey = [idea.id, linkId].sort().join('-');
        if (!processedLinks.has(linkKey)) {
          processedLinks.add(linkKey);
          const linkedIdea = ideas.find(i => i.id === linkId);
          if (linkedIdea) {
            lines.push({
              from: idea.canvas_pos,
              to: linkedIdea.canvas_pos
            });
          }
        }
      });
    }
  });

  return lines.map(line => {
    const fromBubble = document.querySelector(`.idea-bubble[data-id="${line.from.id}"]`);
    const toBubble = document.querySelector(`.idea-bubble[data-id="${line.to.id}"]`);
    
    let x1, y1, x2, y2;
    
    if (fromBubble && toBubble) {
      x1 = fromBubble.offsetLeft + fromBubble.offsetWidth / 2 + 5000;
      y1 = fromBubble.offsetTop + fromBubble.offsetHeight / 2 + 5000;
      x2 = toBubble.offsetLeft + toBubble.offsetWidth / 2 + 5000;
      y2 = toBubble.offsetTop + toBubble.offsetHeight / 2 + 5000;
    } else {
      x1 = line.from.x + 130 + 5000;
      y1 = line.from.y + 80 + 5000;
      x2 = line.to.x + 130 + 5000;
      y2 = line.to.y + 80 + 5000;
    }
    
    const linkKey = [line.from.id, line.to.id].sort().join('-');
    const isSelected = canvasState.selectedLink === linkKey;
    
    return `<line 
      class="connection-line ${isSelected ? 'selected' : ''}" 
      data-link="${linkKey}"
      data-from="${line.from.id}"
      data-to="${line.to.id}"
      x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      stroke="#d4a574" 
      stroke-width="${isSelected ? 4 : 2}" 
      stroke-dasharray="5,5" 
      style="cursor: ${canvasState.linkMode ? 'pointer' : 'default'}"
    />`;
  }).join('');
}

function updateConnectionLines(state) {
  const svg = document.getElementById('connection-lines');
  if (!svg) return;
  
  const ideas = state.getFilteredIdeas();
  const lines = [];
  const processedLinks = new Set();

  ideas.forEach(idea => {
    if (idea.links && idea.links.length > 0) {
      idea.links.forEach(linkId => {
        const linkKey = [idea.id, linkId].sort().join('-');
        if (!processedLinks.has(linkKey)) {
          processedLinks.add(linkKey);
          const linkedIdea = ideas.find(i => i.id === linkId);
          if (linkedIdea) {
            const fromBubble = document.querySelector(`.idea-bubble[data-id="${idea.id}"]`);
            const toBubble = document.querySelector(`.idea-bubble[data-id="${linkId}"]`);
            
            const fromPos = fromBubble ? {
              x: parseFloat(fromBubble.style.left),
              y: parseFloat(fromBubble.style.top),
              id: idea.id
            } : { ...idea.canvas_pos, id: idea.id };
            
            const toPos = toBubble ? {
              x: parseFloat(toBubble.style.left),
              y: parseFloat(toBubble.style.top),
              id: linkId
            } : { ...linkedIdea.canvas_pos, id: linkId };
            
            lines.push({ from: fromPos, to: toPos });
          }
        }
      });
    }
  });

  svg.innerHTML = lines.map(line => {
    const fromBubble = document.querySelector(`.idea-bubble[data-id="${line.from.id}"]`);
    const toBubble = document.querySelector(`.idea-bubble[data-id="${line.to.id}"]`);
    
    let x1, y1, x2, y2;
    
    if (fromBubble && toBubble) {
      x1 = fromBubble.offsetLeft + fromBubble.offsetWidth / 2 + 5000;
      y1 = fromBubble.offsetTop + fromBubble.offsetHeight / 2 + 5000;
      x2 = toBubble.offsetLeft + toBubble.offsetWidth / 2 + 5000;
      y2 = toBubble.offsetTop + toBubble.offsetHeight / 2 + 5000;
    } else {
      x1 = line.from.x + 130 + 5000;
      y1 = line.from.y + 80 + 5000;
      x2 = line.to.x + 130 + 5000;
      y2 = line.to.y + 80 + 5000;
    }
    
    const linkKey = [line.from.id, line.to.id].sort().join('-');
    const isSelected = canvasState.selectedLink === linkKey;
    
    return `<line 
      class="connection-line ${isSelected ? 'selected' : ''}" 
      data-link="${linkKey}"
      data-from="${line.from.id}"
      data-to="${line.to.id}"
      x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      stroke="#d4a574" 
      stroke-width="${isSelected ? 4 : 2}" 
      stroke-dasharray="5,5" 
      style="cursor: ${canvasState.linkMode ? 'pointer' : 'default'}"
    />`;
  }).join('');
}

function renderBubble(idea, state) {
  const isDue = isIdeaDue(idea);
  const isMerged = idea.merged_from && idea.merged_from.length > 0;
  const bubbleClass = `bubble bubble-${idea.color_variant} ${state.settings.bubbleFloat ? 'bubble-float' : ''}`;
  const animationDelay = (parseInt(idea.id.slice(-8), 16) % 6000) / 1000;

  return `
    <div class="idea-bubble ${bubbleClass} ${isMerged ? 'merged-bubble' : ''}"
         data-id="${idea.id}"
         style="left: ${idea.canvas_pos.x}px; top: ${idea.canvas_pos.y}px; animation-delay: ${animationDelay}s;">
      ${isDue ? '<div class="due-indicator"></div>' : ''}
      <div class="idea-bubble-quick-actions">
        <button class="quick-action-btn" data-action="edit" title="Edit">✎</button>
        <button class="quick-action-btn" data-action="link" title="Link">🔗</button>
      </div>
      <div class="idea-bubble-title">${escapeHtml(idea.title || 'Untitled Idea')}</div>
      <div class="idea-bubble-meta">
        <span class="status-pill">${escapeHtml(idea.status)}</span>
      </div>
      <div class="confidence-ring" style="--confidence-color: var(--color-bubble-${idea.color_variant}); --confidence-percent: ${idea.confidence}%;">
        <div class="confidence-ring-progress"></div>
        <span>${idea.confidence}</span>
      </div>
      ${isMerged ? '<div class="merged-badge">Merged</div>' : ''}
    </div>
  `;
}

function attachCanvasListeners(state) {
  const canvas = document.getElementById('bubble-canvas');
  const container = document.getElementById('canvas-container');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomLevel = document.getElementById('zoom-level');
  const resetViewBtn = document.getElementById('reset-view');

  if (!canvas || !container) return;

  const updateTransform = () => {
    container.style.transform = `translate(${canvasState.offsetX}px, ${canvasState.offsetY}px) scale(${canvasState.scale})`;
    if (zoomLevel) {
      zoomLevel.textContent = Math.round(canvasState.scale * 100) + '%';
    }
  };

  canvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('.idea-bubble')) {
      const bubble = e.target.closest('.idea-bubble');
      if (e.target.closest('.quick-action-btn')) {
        return;
      }
      
      canvasState.isDragging = true;
      canvasState.draggedBubble = bubble;
      canvasState.dragStartX = (e.clientX - canvasState.offsetX) / canvasState.scale - parseFloat(bubble.style.left);
      canvasState.dragStartY = (e.clientY - canvasState.offsetY) / canvasState.scale - parseFloat(bubble.style.top);
      canvasState.bubbleWasMoved = false;
      bubble.classList.add('dragging');
    } else {
      canvasState.isPanning = true;
      canvasState.panStartX = e.clientX - canvasState.offsetX;
      canvasState.panStartY = e.clientY - canvasState.offsetY;
      canvas.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (canvasState.isDragging && canvasState.draggedBubble) {
      const x = (e.clientX - canvasState.offsetX) / canvasState.scale - canvasState.dragStartX;
      const y = (e.clientY - canvasState.offsetY) / canvasState.scale - canvasState.dragStartY;
      canvasState.draggedBubble.style.left = x + 'px';
      canvasState.draggedBubble.style.top = y + 'px';
      canvasState.bubbleWasMoved = true;
      updateConnectionLines(state);
    } else if (canvasState.isPanning) {
      canvasState.offsetX = e.clientX - canvasState.panStartX;
      canvasState.offsetY = e.clientY - canvasState.panStartY;
      updateTransform();
    }
  });

  document.addEventListener('mouseup', async () => {
    if (canvasState.isDragging && canvasState.draggedBubble) {
      const bubble = canvasState.draggedBubble;
      const ideaId = bubble.dataset.id;
      const idea = state.ideas.find(i => i.id === ideaId);
      if (idea) {
        idea.canvas_pos.x = parseFloat(bubble.style.left);
        idea.canvas_pos.y = parseFloat(bubble.style.top);
        await state.updateIdea(idea);
        updateConnectionLines(state);
      }
      if (bubble && bubble.classList) {
        bubble.classList.remove('dragging');
      }
    }
    
    canvasState.isDragging = false;
    canvasState.isPanning = false;
    canvasState.draggedBubble = null;
    if (canvas) canvas.style.cursor = '';
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    canvasState.scale = Math.max(0.2, Math.min(1.5, canvasState.scale + delta));
    updateTransform();
  });

  canvas.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.idea-bubble')) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvasState.offsetX) / canvasState.scale;
      const y = (e.clientY - rect.top - canvasState.offsetY) / canvasState.scale;
      
      const title = prompt('Enter idea title:');
      if (title) {
        state.createIdea({ title, canvas_pos: { x, y } });
      }
    }
  });

  canvas.addEventListener('click', async (e) => {
    const bubble = e.target.closest('.idea-bubble');
    const connectionLine = e.target.closest('.connection-line');
    
    if (connectionLine && canvasState.linkMode) {
      const linkKey = connectionLine.dataset.link;
      if (canvasState.selectedLink === linkKey) {
        canvasState.selectedLink = null;
      } else {
        canvasState.selectedLink = linkKey;
      }
      updateConnectionLines(state);
      return;
    }
    
    if (bubble) {
      const actionBtn = e.target.closest('.quick-action-btn');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const ideaId = bubble.dataset.id;
        
        if (action === 'edit') {
          state.setSelectedIdeaId(ideaId);
        } else if (action === 'link') {
          showLinkDialog(state, ideaId);
        }
      } else if (!canvasState.bubbleWasMoved) {
        if (canvasState.linkMode) {
          const ideaId = bubble.dataset.id;
          if (!canvasState.linkSourceBubble) {
            canvasState.linkSourceBubble = bubble;
            bubble.classList.add('link-source');
          } else {
            const sourceId = canvasState.linkSourceBubble.dataset.id;
            const targetId = ideaId;
            
            if (sourceId !== targetId) {
              const sourceIdea = state.ideas.find(i => i.id === sourceId);
              const targetIdea = state.ideas.find(i => i.id === targetId);
              if (sourceIdea && targetIdea) {
                if (!sourceIdea.links.includes(targetId)) {
                  sourceIdea.links.push(targetId);
                  targetIdea.links.push(sourceId);
                  await state.updateIdea(sourceIdea);
                  await state.updateIdea(targetIdea);
                }
              }
            }
            
            canvasState.linkSourceBubble.classList.remove('link-source');
            canvasState.linkSourceBubble = null;
          }
        } else if (canvasState.mergeMode) {
          const ideaId = bubble.dataset.id;
          if (!canvasState.mergeSourceBubble) {
            canvasState.mergeSourceBubble = bubble;
            bubble.classList.add('merge-source');
          } else {
            const sourceId = canvasState.mergeSourceBubble.dataset.id;
            const targetId = ideaId;
            
            if (sourceId !== targetId) {
              showMergeDialog(state, sourceId, targetId);
            }
            
            canvasState.mergeSourceBubble.classList.remove('merge-source');
            canvasState.mergeSourceBubble = null;
          }
        } else {
          const ideaId = bubble.dataset.id;
          const idea = state.ideas.find(i => i.id === ideaId);
          if (idea && isIdeaDue(idea)) {
            showReviewModal(idea, 
              (id, data) => state.submitReview(id, data),
              (id, days) => state.snoozeIdea(id, days),
              (id) => state.archiveIdea(id)
            );
          } else {
            state.setSelectedIdeaId(ideaId);
          }
        }
      }
    }
  });

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      canvasState.scale = Math.min(1.5, canvasState.scale + 0.1);
      updateTransform();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      canvasState.scale = Math.max(0.2, canvasState.scale - 0.1);
      updateTransform();
    });
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', () => {
      canvasState.scale = 1;
      canvasState.offsetX = 0;
      canvasState.offsetY = 0;
      updateTransform();
    });
  }

  const linkModeBtn = document.getElementById('link-mode-btn');
  if (linkModeBtn) {
    linkModeBtn.addEventListener('click', () => {
      canvasState.linkMode = !canvasState.linkMode;
      linkModeBtn.classList.toggle('active', canvasState.linkMode);
      canvas.style.cursor = canvasState.linkMode ? 'crosshair' : '';
      
      if (canvasState.linkMode) {
        canvasState.mergeMode = false;
        const mergeModeBtn = document.getElementById('merge-mode-btn');
        if (mergeModeBtn) mergeModeBtn.classList.remove('active');
        if (canvasState.mergeSourceBubble) {
          canvasState.mergeSourceBubble.classList.remove('merge-source');
          canvasState.mergeSourceBubble = null;
        }
      }
      
      if (!canvasState.linkMode) {
        if (canvasState.linkSourceBubble) {
          canvasState.linkSourceBubble.classList.remove('link-source');
          canvasState.linkSourceBubble = null;
        }
        canvasState.selectedLink = null;
        updateConnectionLines(state);
      }
    });
  }

  const mergeModeBtn = document.getElementById('merge-mode-btn');
  if (mergeModeBtn) {
    mergeModeBtn.addEventListener('click', () => {
      canvasState.mergeMode = !canvasState.mergeMode;
      mergeModeBtn.classList.toggle('active', canvasState.mergeMode);
      canvas.style.cursor = canvasState.mergeMode ? 'crosshair' : '';
      
      if (canvasState.mergeMode) {
        canvasState.linkMode = false;
        linkModeBtn.classList.remove('active');
        if (canvasState.linkSourceBubble) {
          canvasState.linkSourceBubble.classList.remove('link-source');
          canvasState.linkSourceBubble = null;
        }
        canvasState.selectedLink = null;
        updateConnectionLines(state);
      }
      
      if (!canvasState.mergeMode) {
        if (canvasState.mergeSourceBubble) {
          canvasState.mergeSourceBubble.classList.remove('merge-source');
          canvasState.mergeSourceBubble = null;
        }
      }
    });
  }
  
  document.addEventListener('keydown', async (e) => {
    if (canvasState.linkMode && canvasState.selectedLink && (e.key === 'Delete' || e.key === 'Backspace')) {
      const [fromId, toId] = canvasState.selectedLink.split('-');
      const fromIdea = state.ideas.find(i => i.id === fromId);
      const toIdea = state.ideas.find(i => i.id === toId);
      
      if (fromIdea && toIdea) {
        fromIdea.links = fromIdea.links.filter(id => id !== toId);
        toIdea.links = toIdea.links.filter(id => id !== fromId);
        await state.updateIdea(fromIdea);
        await state.updateIdea(toIdea);
        canvasState.selectedLink = null;
        updateConnectionLines(state);
      }
    }
  });

  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      state.setCurrentView(view);
    });
  });
}

function showLinkDialog(state, ideaId) {
  const otherIdeas = state.ideas.filter(i => i.id !== ideaId);
  
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="link-modal">
      <div class="modal-content" style="max-width: 400px;">
        <h2 style="margin-bottom: 16px;">Link Idea</h2>
        <select id="link-select" style="width: 100%; margin-bottom: 16px;">
          <option value="">Select an idea to link...</option>
          ${otherIdeas.map(i => `<option value="${i.id}">${escapeHtml(i.title || 'Untitled')}</option>`).join('')}
        </select>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-link">Cancel</button>
          <button class="primary" id="confirm-link">Link</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-link').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('confirm-link').addEventListener('click', async () => {
    const targetId = document.getElementById('link-select').value;
    if (targetId) {
      const idea = state.ideas.find(i => i.id === ideaId);
      const targetIdea = state.ideas.find(i => i.id === targetId);
      if (idea && targetIdea) {
        idea.links.push(targetId);
        targetIdea.links.push(ideaId);
        await state.updateIdea(idea);
        await state.updateIdea(targetIdea);
      }
    }
    container.innerHTML = '';
  });
}

function showMergeDialog(state, ideaIdA, ideaIdB) {
  const ideaA = state.ideas.find(i => i.id === ideaIdA);
  const ideaB = state.ideas.find(i => i.id === ideaIdB);
  if (!ideaA || !ideaB) return;
  
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="merge-modal">
      <div class="modal-content" style="max-width: 500px;">
        <h2 style="margin-bottom: 16px;">Merge Ideas</h2>
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
          <strong>Merging:</strong>
          <div style="margin-top: 8px;">• ${escapeHtml(ideaA.title || 'Untitled')}</div>
          <div>• ${escapeHtml(ideaB.title || 'Untitled')}</div>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="merge-title" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Merged Title</label>
          <input id="merge-title" value="${escapeHtml(ideaA.title + ' + ' + ideaB.title)}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-outline);">
        </div>
        <div style="margin-bottom: 16px;">
          <label for="merge-summary" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Merged Summary</label>
          <textarea id="merge-summary" rows="4" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-outline);">${escapeHtml((ideaA.summary || '') + '\n\n' + (ideaB.summary || ''))}</textarea>
        </div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 16px;">
          The original ideas will be archived. The merged idea will combine all assumptions, questions, next steps, and tags from both ideas.
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-merge">Cancel</button>
          <button class="primary" id="confirm-merge">Merge</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-merge').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('confirm-merge').addEventListener('click', async () => {
    const mergedData = {
      title: document.getElementById('merge-title').value,
      summary: document.getElementById('merge-summary').value
    };
    await state.mergeIdeas(ideaIdA, ideaIdB, mergedData);
    container.innerHTML = '';
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
