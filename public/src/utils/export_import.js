export async function exportToPideas(ideas, settings) {
  const exportData = {
    version: 1,
    exported_at: Date.now(),
    ideas: ideas,
    settings: settings
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ideas-backup-${new Date().toISOString().split('T')[0]}.pideas`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToMarkdown(ideas) {
  let md = '# Idea Incubator Export\n\n';
  md += `Exported: ${new Date().toLocaleString()}\n\n`;
  md += '---\n\n';

  ideas.forEach(idea => {
    md += `## ${escapeMd(idea.title || 'Untitled Idea')}\n\n`;
    md += `**Status:** ${escapeMd(idea.status)} | **Confidence:** ${idea.confidence}%\n\n`;
    
    if (idea.summary) {
      md += `### Summary\n${escapeMd(idea.summary)}\n\n`;
    }
    
    if (idea.problem) {
      md += `### Problem\n${escapeMd(idea.problem)}\n\n`;
    }
    
    if (idea.why_interesting) {
      md += `### Why Interesting\n${escapeMd(idea.why_interesting)}\n\n`;
    }
    
    if (idea.assumptions.length > 0) {
      md += `### Assumptions\n`;
      idea.assumptions.forEach(a => {
        md += `- ${escapeMd(a.text)} (${a.confidence}, ${a.status})\n`;
      });
      md += '\n';
    }
    
    if (idea.open_questions.length > 0) {
      md += `### Open Questions\n`;
      idea.open_questions.forEach(q => {
        md += `- ${escapeMd(q.text)} (${q.status})\n`;
      });
      md += '\n';
    }
    
    if (idea.next_steps.length > 0) {
      md += `### Next Steps\n`;
      idea.next_steps.forEach(s => {
        md += `- [${s.status === 'done' ? 'x' : ' '}] ${escapeMd(s.text)}\n`;
      });
      md += '\n';
    }
    
    md += '---\n\n';
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ideas-export-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromPideas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.version !== 1) {
          reject(new Error('Unsupported file version'));
          return;
        }
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function showImportDialog(data, onImport) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const existingIds = new Set();
  const newIdeas = [];
  const conflictingIdeas = [];

  data.ideas.forEach(idea => {
    if (existingIds.has(idea.id)) {
      conflictingIdeas.push(idea);
    } else {
      newIdeas.push(idea);
    }
    existingIds.add(idea.id);
  });

  container.innerHTML = `
    <div class="modal-overlay" id="import-modal">
      <div class="modal-content" style="max-width: 600px;">
        <h2 style="margin-bottom: 16px;">Import Ideas</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
          This file contains ${data.ideas.length} idea(s).
        </p>
        
        ${conflictingIdeas.length > 0 ? `
          <div style="padding: 12px; border-radius: 8px; background: rgba(184, 92, 92, 0.1); margin-bottom: 16px;">
            <p style="color: var(--color-danger); font-weight: 500;">${conflictingIdeas.length} conflicting idea(s) found</p>
            <p style="font-size: 13px; color: var(--color-text-secondary);">These ideas have IDs that already exist in your database.</p>
          </div>
        ` : ''}
        
        <div style="margin-bottom: 24px;">
          <label for="conflict-resolution" style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Conflict Resolution</label>
          <select id="conflict-resolution" style="width: 100%;">
            <option value="skip">Skip conflicting ideas</option>
            <option value="overwrite">Overwrite existing ideas</option>
            <option value="duplicate">Import as duplicates (new IDs)</option>
          </select>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="secondary" id="cancel-import">Cancel</button>
          <button class="primary" id="confirm-import">Import</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-import').addEventListener('click', () => {
    container.innerHTML = '';
  });

  document.getElementById('confirm-import').addEventListener('click', () => {
    const resolution = document.getElementById('conflict-resolution').value;
    onImport(data, resolution);
    container.innerHTML = '';
  });
}

function escapeMd(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/#/g, '\\#')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
