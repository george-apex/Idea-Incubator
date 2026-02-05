import { isIdeaDue } from '../models/idea.js';
import { showReviewModal } from './review_modal.js';

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
  mergeSourceBubble: null,
  contextMenu: null
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
        <button class="secondary" id="auto-layout">Auto Layout</button>
        <button class="secondary" id="toggle-legend">Legend</button>
        <button class="secondary" id="fit-view">Fit View</button>
        <button class="secondary" id="reset-view">Reset View</button>
      </div>
    </div>
    <div class="panel-content">
      <div class="bubble-canvas" id="bubble-canvas">
        <div class="canvas-container" id="canvas-container">
          <svg class="connection-lines" id="connection-lines" style="overflow: visible; position: absolute; top: -5000px; left: -5000px; width: 20000px; height: 20000px;">
            <defs>
              <marker id="arrowhead-parent" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#8b7355" />
              </marker>
              <marker id="arrowhead-peer" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#d4a574" />
              </marker>
            </defs>
            ${renderConnectionLines(ideas)}
          </svg>
          ${ideas.map(idea => renderBubble(idea, state)).join('')}
        </div>
        <div class="canvas-controls">
          <button class="canvas-control-btn" id="zoom-out">−</button>
          <span class="canvas-zoom-level" id="zoom-level">100%</span>
          <button class="canvas-control-btn" id="zoom-in">+</button>
        </div>
        <div class="minimap" id="minimap">
          <div class="minimap-content" id="minimap-content"></div>
          <div class="minimap-viewport" id="minimap-viewport"></div>
        </div>
        <div class="link-legend" id="link-legend" style="display: none;">
          <div class="legend-title">Link Types</div>
          <div class="legend-item">
            <svg width="40" height="20" style="display: inline-block; vertical-align: middle;">
              <line x1="0" y1="10" x2="40" y2="10" stroke="#8b7355" stroke-width="3" />
              <polygon points="35,6 40,10 35,14" fill="#8b7355" />
            </svg>
            <span>Parent → Child</span>
          </div>
          <div class="legend-item">
            <svg width="40" height="20" style="display: inline-block; vertical-align: middle;">
              <line x1="0" y1="10" x2="40" y2="10" stroke="#d4a574" stroke-width="2" stroke-dasharray="5,5" />
            </svg>
            <span>Peer Connection</span>
          </div>
          <div class="legend-divider"></div>
          <div class="legend-title">View Controls</div>
          <div class="legend-item">
            <span>Drag to pan</span>
          </div>
          <div class="legend-item">
            <span>Scroll to zoom</span>
          </div>
          <div class="legend-item">
            <span>Click minimap to navigate</span>
          </div>
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
      updateMinimap(state);
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
            const isParentChild = idea.parent_id === linkId || linkedIdea.parent_id === idea.id;
            lines.push({
              from: idea.canvas_pos,
              to: linkedIdea.canvas_pos,
              isParentChild
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
    const linkTypeClass = line.isParentChild ? 'parent-child' : 'peer';
    const markerEnd = line.isParentChild ? 'url(#arrowhead-parent)' : '';
    
    return `<line 
      class="connection-line ${linkTypeClass} ${isSelected ? 'selected' : ''}" 
      data-link="${linkKey}"
      data-from="${line.from.id}"
      data-to="${line.to.id}"
      x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      marker-end="${markerEnd}"
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
            
            const isParentChild = idea.parent_id === linkId || linkedIdea.parent_id === idea.id;
            lines.push({ from: fromPos, to: toPos, isParentChild });
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
    const linkTypeClass = line.isParentChild ? 'parent-child' : 'peer';
    const markerEnd = line.isParentChild ? 'url(#arrowhead-parent)' : '';
    
    return `<line 
      class="connection-line ${linkTypeClass} ${isSelected ? 'selected' : ''}" 
      data-link="${linkKey}"
      data-from="${line.from.id}"
      data-to="${line.to.id}"
      x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      marker-end="${markerEnd}"
      style="cursor: ${canvasState.linkMode ? 'pointer' : 'default'}"
    />`;
  }).join('');
}

function renderBubble(idea, state) {
  const isDue = isIdeaDue(idea);
  const isMerged = idea.merged_from && idea.merged_from.length > 0;
  const isAISuggestion = idea.is_ai_suggestion;
  const bubbleClass = `bubble bubble-${idea.color_variant} ${state.settings.bubbleFloat ? 'bubble-float' : ''} ${isAISuggestion ? 'ai-suggestion-bubble' : ''}`;
  const animationDelay = (parseInt(idea.id.slice(-8), 16) % 6000) / 1000;

  return `
    <div class="idea-bubble ${bubbleClass} ${isMerged ? 'merged-bubble' : ''}"
         data-id="${idea.id}"
         style="left: ${idea.canvas_pos.x}px; top: ${idea.canvas_pos.y}px; animation-delay: ${animationDelay}s;">
      ${isDue ? '<div class="due-indicator"></div>' : ''}
      ${isAISuggestion ? '<div class="ai-suggestion-badge"></div>' : ''}
      <div class="idea-bubble-quick-actions">
        ${isAISuggestion ? `
          <button class="quick-action-btn suggestion-accept" data-action="accept-suggestion" title="Accept">✓</button>
          <button class="quick-action-btn suggestion-dismiss" data-action="dismiss-suggestion" title="Dismiss">✕</button>
        ` : `
          <button class="quick-action-btn" data-action="edit" title="Edit">✎</button>
          <button class="quick-action-btn" data-action="link" title="Link">🔗</button>
        `}
      </div>
      <div class="idea-bubble-title">${escapeHtml(idea.title || 'Untitled Idea')}</div>
      ${isAISuggestion && idea.suggestion_type ? `
        <div class="ai-suggestion-type">${escapeHtml(getSuggestionTypeLabel(idea.suggestion_type))}</div>
      ` : ''}
      <div class="idea-bubble-meta">
        <span class="status-pill">${escapeHtml(idea.status)}</span>
      </div>
      ${isAISuggestion && idea.suggestion_reason ? `
        <div class="ai-suggestion-reason">${escapeHtml(idea.suggestion_reason)}</div>
      ` : ''}
      <div class="confidence-ring" style="--confidence-color: var(--color-bubble-${idea.color_variant}); --confidence-percent: ${idea.confidence}%;">
        <div class="confidence-ring-progress"></div>
        <span>${idea.confidence}</span>
      </div>
      ${isMerged ? '<div class="merged-badge">Merged</div>' : ''}
    </div>
  `;
}

function getSuggestionTypeLabel(type) {
  const labels = {
    'improvement': '💡 Improvement',
    'connection': '🔗 Connection',
    'new_idea': '✨ New Idea',
    'merge': '🔀 Merge'
  };
  return labels[type] || '✨ Suggestion';
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
    updateMinimap(state);
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
      updateMinimap(state);
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
        } else if (action === 'accept-suggestion') {
          acceptSuggestion(ideaId, state);
        } else if (action === 'dismiss-suggestion') {
          dismissSuggestion(ideaId, state);
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
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, bubble, idea, state);
            return;
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

  const fitViewBtn = document.getElementById('fit-view');
  if (fitViewBtn) {
    fitViewBtn.addEventListener('click', () => {
      autoFitCanvas(state);
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

  const autoLayoutBtn = document.getElementById('auto-layout');
  if (autoLayoutBtn) {
    autoLayoutBtn.addEventListener('click', async () => {
      showLayoutDialog(state);
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
    
    if (e.key === 'Escape') {
      closeContextMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (canvasState.contextMenu && !e.target.closest('.idea-context-menu') && !e.target.closest('.idea-bubble')) {
      closeContextMenu();
    }
  });

  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      state.setCurrentView(view);
    });
  });

  const minimap = document.getElementById('minimap');
  if (minimap) {
    minimap.addEventListener('click', (e) => {
      const rect = minimap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const ideas = state.getFilteredIdeas();
      if (ideas.length === 0) return;
      
      const minX = Math.min(...ideas.map(i => i.canvas_pos.x));
      const maxX = Math.max(...ideas.map(i => i.canvas_pos.x + 260));
      const minY = Math.min(...ideas.map(i => i.canvas_pos.y));
      const maxY = Math.max(...ideas.map(i => i.canvas_pos.y + 160));
      
      const contentWidth = maxX - minX + 100;
      const contentHeight = maxY - minY + 100;
      
      const contentX = minX + x * contentWidth;
      const contentY = minY + y * contentHeight;
      
      const canvas = document.getElementById('bubble-canvas');
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        canvasState.offsetX = canvasRect.width / 2 - contentX * canvasState.scale;
        canvasState.offsetY = canvasRect.height / 2 - contentY * canvasState.scale;
        
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
          canvasContainer.style.transform = `translate(${canvasState.offsetX}px, ${canvasState.offsetY}px) scale(${canvasState.scale})`;
        }
        updateMinimap(state);
      }
    });
  }

  const toggleLegendBtn = document.getElementById('toggle-legend');
  if (toggleLegendBtn) {
    toggleLegendBtn.addEventListener('click', () => {
      const legend = document.getElementById('link-legend');
      if (legend) {
        legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
}

function updateMinimap(state) {
  const minimapContent = document.getElementById('minimap-content');
  const minimapViewport = document.getElementById('minimap-viewport');
  const canvas = document.getElementById('bubble-canvas');
  
  if (!minimapContent || !minimapViewport || !canvas) return;
  
  const ideas = state.getFilteredIdeas();
  if (ideas.length === 0) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  
  const minX = Math.min(...ideas.map(i => i.canvas_pos.x));
  const maxX = Math.max(...ideas.map(i => i.canvas_pos.x + 260));
  const minY = Math.min(...ideas.map(i => i.canvas_pos.y));
  const maxY = Math.max(...ideas.map(i => i.canvas_pos.y + 160));
  
  const width = maxX - minX + 100;
  const height = maxY - minY + 100;
  
  minimapContent.innerHTML = ideas.map(idea => {
    const x = ((idea.canvas_pos.x - minX) / width) * 100;
    const y = ((idea.canvas_pos.y - minY) / height) * 100;
    const w = (260 / width) * 100;
    const h = (160 / height) * 100;
    return `<div class="minimap-bubble" style="left: ${x}%; top: ${y}%; width: ${w}%; height: ${h}%;"></div>`;
  }).join('');
  
  const viewportX = ((-canvasState.offsetX / canvasState.scale - minX) / width) * 100;
  const viewportY = ((-canvasState.offsetY / canvasState.scale - minY) / height) * 100;
  const viewportW = (canvasRect.width / canvasState.scale / width) * 100;
  const viewportH = (canvasRect.height / canvasState.scale / height) * 100;
  
  minimapViewport.style.left = `${viewportX}%`;
  minimapViewport.style.top = `${viewportY}%`;
  minimapViewport.style.width = `${viewportW}%`;
  minimapViewport.style.height = `${viewportH}%`;
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

function showContextMenu(e, bubble, idea, state) {
  e.preventDefault();
  e.stopPropagation();

  closeContextMenu();

  const isMerged = idea.merged_from && idea.merged_from.length > 0;
  const linkedIdeas = idea.links.map(id => state.ideas.find(i => i.id === id)).filter(Boolean);

  const menu = document.createElement('div');
  menu.className = 'idea-context-menu';
  menu.style.position = 'fixed';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="update">
      <span>Update</span>
    </div>
    <div class="context-menu-item" data-action="links">
      <span>Manage Links (${linkedIdeas.length})</span>
    </div>
    ${isMerged ? `
      <div class="context-menu-item" data-action="split">
        <span>Split Idea</span>
      </div>
    ` : ''}
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-action="archive">
      <span>${idea.is_archived ? 'Unarchive' : 'Archive'}</span>
    </div>
    <div class="context-menu-item danger" data-action="delete">
      <span>Delete</span>
    </div>
  `;

  const rect = bubble.getBoundingClientRect();
  menu.style.left = (rect.right + 10) + 'px';
  menu.style.top = rect.top + 'px';

  document.body.appendChild(menu);
  canvasState.contextMenu = menu;
  
  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    const action = e.target.closest('.context-menu-item')?.dataset.action;
    if (!action) return;
    
    closeContextMenu();
    
    switch (action) {
      case 'update':
        state.setSelectedIdeaId(idea.id);
        break;
      case 'links':
        showLinksContextMenu(bubble, idea, state);
        break;
      case 'split':
        showSplitDialog(idea, state);
        break;
      case 'archive':
        if (idea.is_archived) {
          await state.unarchiveIdea(idea.id);
        } else {
          await state.archiveIdea(idea.id);
        }
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this idea?')) {
          await state.deleteIdea(idea.id);
        }
        break;
    }
  });
}

function showLinksContextMenu(bubble, idea, state) {
  closeContextMenu();

  const linkedIdeas = idea.links.map(id => state.ideas.find(i => i.id === id)).filter(Boolean);
  const otherIdeas = state.ideas.filter(i => i.id !== idea.id && !idea.links.includes(i.id));

  const menu = document.createElement('div');
  menu.className = 'idea-context-menu links-menu';
  menu.style.position = 'fixed';
  menu.innerHTML = `
    <div class="context-menu-header">Manage Links</div>
    ${linkedIdeas.length > 0 ? `
      <div class="context-menu-section">
        <div class="context-menu-section-title">Linked Ideas</div>
        ${linkedIdeas.map(linked => `
          <div class="context-menu-item linked-item" data-link-id="${linked.id}">
            <span class="link-title">${escapeHtml(linked.title || 'Untitled')}</span>
            <span class="remove-link" data-remove-id="${linked.id}">×</span>
          </div>
        `).join('')}
      </div>
    ` : '<div class="context-menu-empty">No linked ideas</div>'}
    <div class="context-menu-divider"></div>
    <div class="context-menu-section">
      <div class="context-menu-section-title">Add Link</div>
      <select class="link-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-outline);">
        <option value="">Select an idea...</option>
        ${otherIdeas.map(i => `<option value="${i.id}">${escapeHtml(i.title || 'Untitled')}</option>`).join('')}
      </select>
    </div>
  `;

  const rect = bubble.getBoundingClientRect();

  menu.style.left = (rect.right + 10) + 'px';
  menu.style.top = rect.top + 'px';

  document.body.appendChild(menu);
  canvasState.contextMenu = menu;
  
  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    const removeBtn = e.target.closest('.remove-link');
    if (removeBtn) {
      const linkId = removeBtn.dataset.removeId;
      idea.links = idea.links.filter(id => id !== linkId);
      const linkedIdea = state.ideas.find(i => i.id === linkId);
      if (linkedIdea) {
        linkedIdea.links = linkedIdea.links.filter(id => id !== idea.id);
        await state.updateIdea(linkedIdea);
      }
      await state.updateIdea(idea);
      showLinksContextMenu(bubble, idea, state);
      return;
    }
    
    const linkSelect = menu.querySelector('.link-select');
    if (linkSelect && linkSelect.value) {
      const targetId = linkSelect.value;
      const targetIdea = state.ideas.find(i => i.id === targetId);
      if (targetIdea) {
        idea.links.push(targetId);
        targetIdea.links.push(idea.id);
        await state.updateIdea(idea);
        await state.updateIdea(targetIdea);
        showLinksContextMenu(bubble, idea, state);
      }
    }
  });
}

function showSplitDialog(idea, state) {
  const originalIdeas = idea.merged_from.map(id => state.ideas.find(i => i.id === id)).filter(Boolean);
  if (originalIdeas.length === 0) {
    alert('Cannot split: original ideas not found');
    return;
  }

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="split-modal">
      <div class="modal-content" style="max-width: 500px;">
        <h2 style="margin-bottom: 16px;">Split Merged Idea</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 16px;">
          This will restore the original ideas that were merged into "${escapeHtml(idea.title)}". The merged idea will be deleted.
        </p>
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(255, 255, 255, 0.5); border-radius: 8px;">
          <strong>Original ideas to restore:</strong>
          ${originalIdeas.map(i => `<div style="margin-top: 8px;">• ${escapeHtml(i.title || 'Untitled')}</div>`).join('')}
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-split">Cancel</button>
          <button class="primary" id="confirm-split">Split</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-split').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('confirm-split').addEventListener('click', async () => {
    await state.splitIdea(idea.id);
    container.innerHTML = '';
  });
}

function showLayoutDialog(state) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="layout-modal">
      <div class="modal-content" style="max-width: 450px;">
        <h2 style="margin-bottom: 16px;">Auto Layout</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 20px;">
          Choose a layout algorithm to automatically arrange your ideas on the canvas.
        </p>
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Layout Algorithm</label>
          <select id="layout-algorithm" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--color-outline);">
            <option value="force-directed">Force-Directed (Organic)</option>
            <option value="hierarchical">Hierarchical (Tree)</option>
            <option value="circular">Circular (Radial)</option>
            <option value="grid">Grid (Organized)</option>
          </select>
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Spacing</label>
          <input type="range" id="layout-spacing" min="50" max="300" value="150" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">
            <span>Tight</span>
            <span id="spacing-value">150px</span>
            <span>Loose</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-layout">Cancel</button>
          <button class="primary" id="apply-layout">Apply Layout</button>
        </div>
      </div>
    </div>
  `;

  const spacingSlider = document.getElementById('layout-spacing');
  const spacingValue = document.getElementById('spacing-value');
  if (spacingSlider && spacingValue) {
    spacingSlider.addEventListener('input', () => {
      spacingValue.textContent = spacingSlider.value + 'px';
    });
  }

  document.getElementById('cancel-layout').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('apply-layout').addEventListener('click', async () => {
    const algorithm = document.getElementById('layout-algorithm').value;
    const spacing = parseInt(document.getElementById('layout-spacing').value, 10);
    
    await state.autoLayoutCanvas(algorithm, spacing);
    container.innerHTML = '';
  });
}

function closeContextMenu() {
  if (canvasState.contextMenu) {
    canvasState.contextMenu.remove();
    canvasState.contextMenu = null;
  }
}

export function autoFitCanvas(state) {
  const ideas = state.getFilteredIdeas();
  if (ideas.length === 0) return;

  const canvas = document.getElementById('bubble-canvas');
  if (!canvas) return;

  const canvasRect = canvas.getBoundingClientRect();
  
  const minX = Math.min(...ideas.map(i => i.canvas_pos.x));
  const maxX = Math.max(...ideas.map(i => i.canvas_pos.x + 260));
  const minY = Math.min(...ideas.map(i => i.canvas_pos.y));
  const maxY = Math.max(...ideas.map(i => i.canvas_pos.y + 160));

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const contentCenterX = minX + contentWidth / 2;
  const contentCenterY = minY + contentHeight / 2;

  const padding = 100;
  const scaleX = (canvasRect.width - padding * 2) / contentWidth;
  const scaleY = (canvasRect.height - padding * 2) / contentHeight;
  const newScale = Math.min(scaleX, scaleY, 1);

  canvasState.scale = newScale;
  canvasState.offsetX = canvasRect.width / 2 - contentCenterX * newScale;
  canvasState.offsetY = canvasRect.height / 2 - contentCenterY * newScale;

  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.style.transform = `translate(${canvasState.offsetX}px, ${canvasState.offsetY}px) scale(${canvasState.scale})`;
  }

  const zoomLevel = document.getElementById('zoom-level');
  if (zoomLevel) {
    zoomLevel.textContent = Math.round(canvasState.scale * 100) + '%';
  }
}

export function resetCanvasState() {
  canvasState.scale = 1;
  canvasState.offsetX = 0;
  canvasState.offsetY = 0;
}

async function acceptSuggestion(ideaId, state) {
  await state.acceptSuggestion(ideaId);
}

async function dismissSuggestion(ideaId, state) {
  await state.dismissSuggestion(ideaId);
}
