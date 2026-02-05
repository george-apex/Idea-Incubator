export class LayoutEngine {
  constructor(options = {}) {
    this.bubbleWidth = options.bubbleWidth || 260;
    this.bubbleHeight = options.bubbleHeight || 160;
    this.horizontalGap = options.horizontalGap || 80;
    this.verticalGap = options.verticalGap || 200;
    this.canvasWidth = options.canvasWidth || 5000;
    this.canvasHeight = options.canvasHeight || 4000;
  }

  autoLayout(ideas, algorithm = 'force-directed', spacing = 150) {
    switch (algorithm) {
      case 'hierarchical':
        return this.hierarchicalLayout(ideas, spacing);
      case 'circular-ordered':
        return this.circularOrderedLayout(ideas, spacing);
      case 'grid':
        return this.gridLayout(ideas, spacing);
      case 'layered':
        return this.layeredLayout(ideas, spacing);
      case 'hybrid':
        return this.hybridLayout(ideas, spacing);
      case 'status':
        return this.statusLayout(ideas, spacing);
      case 'confidence':
        return this.confidenceLayout(ideas, spacing);
      case 'tag':
        return this.tagLayout(ideas, spacing);
      case 'mindmap':
        return this.mindMapLayout(ideas, spacing);
      case 'force-directed':
      default:
        return this.forceDirectedLayout(ideas, spacing);
    }
  }

  forceDirectedLayout(ideas, spacing = 150, iterations = 100) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const positions = this.initializePositions(ideas);
    const adjacency = this.buildAdjacencyMatrix(ideas);
    const clusters = this.detectClusters(ideas);

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    const repulsionStrength = 50000;
    const attractionStrength = 0.05;
    const clusterStrength = 0.02;
    const centerStrength = 0.001;
    const idealDistance = spacing + this.bubbleWidth;

    for (let iter = 0; iter < iterations; iter++) {
      const forces = ideas.map(() => ({ x: 0, y: 0 }));

      for (let i = 0; i < ideas.length; i++) {
        for (let j = i + 1; j < ideas.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const isParentChild = adjacency[i][j].isParentChild || adjacency[j][i].isParentChild;
          const isLinked = adjacency[i][j].linked || adjacency[j][i].linked;
          const sameCluster = clusters[i] === clusters[j];

          let force = 0;

          if (isParentChild) {
            const targetDist = idealDistance * 1.5;
            force = (distance - targetDist) * attractionStrength * 2;
          } else if (isLinked) {
            const targetDist = idealDistance * 2;
            force = (distance - targetDist) * attractionStrength;
          } else if (sameCluster) {
            const targetDist = idealDistance * 3;
            force = (distance - targetDist) * clusterStrength;
          } else {
            force = -repulsionStrength / (distance * distance);
          }

          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          forces[i].x -= fx;
          forces[i].y -= fy;
          forces[j].x += fx;
          forces[j].y += fy;
        }
      }

      for (let i = 0; i < ideas.length; i++) {
        const dx = centerX - positions[i].x;
        const dy = centerY - positions[i].y;
        forces[i].x += dx * centerStrength;
        forces[i].y += dy * centerStrength;

        const maxForce = 50;
        const forceMag = Math.sqrt(forces[i].x ** 2 + forces[i].y ** 2);
        if (forceMag > maxForce) {
          forces[i].x = (forces[i].x / forceMag) * maxForce;
          forces[i].y = (forces[i].y / forceMag) * maxForce;
        }

        positions[i].x += forces[i].x;
        positions[i].y += forces[i].y;

        const damping = 1 - (iter / iterations) * 0.5;
        positions[i].x *= damping;
        positions[i].y *= damping;
      }
    }

    this.removeOverlaps(positions);
    this.centerLayout(positions);

    return positions;
  }

  hierarchicalLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const ideaMap = new Map();
    ideas.forEach((idea, index) => {
      ideaMap.set(idea.id, { idea, index, children: [] });
    });

    const roots = [];
    ideaMap.forEach(({ idea, children }) => {
      if (idea.parent_id && ideaMap.has(idea.parent_id)) {
        ideaMap.get(idea.parent_id).children.push(idea.id);
      } else {
        roots.push(idea.id);
      }
    });

    const positions = new Map();
    let currentY = 200;

    const layoutLevel = (parentId, level) => {
      const children = parentId
        ? ideaMap.get(parentId).children
        : roots;

      if (children.length === 0) return;

      const sortedChildren = [...children].sort((a, b) => {
        const ideaA = ideaMap.get(a).idea;
        const ideaB = ideaMap.get(b).idea;
        const aConnections = (ideaA.links?.length || 0) + (ideaA.parent_id ? 1 : 0);
        const bConnections = (ideaB.links?.length || 0) + (ideaB.parent_id ? 1 : 0);
        return bConnections - aConnections;
      });

      const groupedChildren = [];
      const used = new Set();

      for (const childId of sortedChildren) {
        if (used.has(childId)) continue;

        const group = [childId];
        const childIdea = ideaMap.get(childId).idea;
        const linkedIds = new Set(childIdea.links || []);

        for (const otherId of sortedChildren) {
          if (used.has(otherId) || otherId === childId) continue;
          if (linkedIds.has(otherId)) {
            group.push(otherId);
            used.add(otherId);
          }
        }

        groupedChildren.push(group);
        used.add(childId);
      }

      const levelWidth = sortedChildren.length * (this.bubbleWidth + spacing) - spacing;
      const startX = (this.canvasWidth - levelWidth) / 2;

      let currentIndex = 0;
      groupedChildren.forEach(group => {
        group.forEach(childId => {
          const x = startX + currentIndex * (this.bubbleWidth + spacing);
          const y = currentY;
          positions.set(childId, { x, y });
          currentIndex++;

          const childData = ideaMap.get(childId);
          if (childData.children.length > 0) {
            currentY += spacing * 1.5;
            layoutLevel(childId, level + 1);
          }
        });
      });

      if (level === 0) {
        currentY += spacing * 1.5 + 100;
      }
    };

    layoutLevel(null, 0);

    const result = [];
    ideas.forEach(idea => {
      if (positions.has(idea.id)) {
        result.push(positions.get(idea.id));
      } else {
        result.push({
          x: Math.random() * (this.canvasWidth - this.bubbleWidth - 100) + 50,
          y: Math.random() * (this.canvasHeight - this.bubbleHeight - 100) + 50
        });
      }
    });

    this.removeOverlaps(result);
    return result;
  }

  circularLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const radius = Math.max(
      (this.bubbleWidth + spacing) * ideas.length / (2 * Math.PI),
      Math.min(this.canvasWidth, this.canvasHeight) * 0.35
    );

    const positions = ideas.map((idea, index) => {
      const angle = (2 * Math.PI * index) / ideas.length - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle) - this.bubbleWidth / 2,
        y: centerY + radius * Math.sin(angle) - this.bubbleHeight / 2
      };
    });

    this.removeOverlaps(positions);
    return positions;
  }

  gridLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];

    const sortedIdeas = [...ideas].sort((a, b) => {
      const aConnections = (a.links?.length || 0) + (a.parent_id ? 1 : 0);
      const bConnections = (b.links?.length || 0) + (b.parent_id ? 1 : 0);
      return bConnections - aConnections;
    });

    const columns = Math.ceil(Math.sqrt(ideas.length));
    const rows = Math.ceil(ideas.length / columns);
    const grid = Array(rows).fill(null).map(() => Array(columns).fill(null));
    const placed = new Set();
    const positions = new Map();

    const getAdjacentCells = (row, col) => {
      const adjacent = [];
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < columns) {
          adjacent.push({ row: newRow, col: newCol });
        }
      }
      return adjacent;
    };

    const findBestCell = (idea) => {
      const linkedIds = new Set(idea.links || []);
      if (idea.parent_id) linkedIds.add(idea.parent_id);

      let bestCell = null;
      let bestScore = -Infinity;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          if (grid[row][col] !== null) continue;

          let score = 0;
          const adjacent = getAdjacentCells(row, col);
          for (const adj of adjacent) {
            const adjIdea = grid[adj.row][adj.col];
            if (adjIdea && linkedIds.has(adjIdea.id)) {
              score += 10;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestCell = { row, col };
          }
        }
      }

      return bestCell;
    };

    for (const idea of sortedIdeas) {
      if (placed.has(idea.id)) continue;

      const cell = findBestCell(idea);
      if (cell) {
        grid[cell.row][cell.col] = idea;
        placed.add(idea.id);
        positions.set(idea.id, {
          x: 200 + cell.col * (this.bubbleWidth + spacing),
          y: 200 + cell.row * (this.bubbleHeight + spacing)
        });

        const linkedIds = new Set(idea.links || []);
        if (idea.parent_id) linkedIds.add(idea.parent_id);

        for (const linkedId of linkedIds) {
          if (placed.has(linkedId)) continue;
          const linkedIdea = ideas.find(i => i.id === linkedId);
          if (!linkedIdea) continue;

          const linkedCell = findBestCell(linkedIdea);
          if (linkedCell) {
            grid[linkedCell.row][linkedCell.col] = linkedIdea;
            placed.add(linkedIdea.id);
            positions.set(linkedIdea.id, {
              x: 200 + linkedCell.col * (this.bubbleWidth + spacing),
              y: 200 + linkedCell.row * (this.bubbleHeight + spacing)
            });
          }
        }
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (grid[row][col] === null) {
          const unplaced = sortedIdeas.find(i => !placed.has(i.id));
          if (unplaced) {
            grid[row][col] = unplaced;
            placed.add(unplaced.id);
            positions.set(unplaced.id, {
              x: 200 + col * (this.bubbleWidth + spacing),
              y: 200 + row * (this.bubbleHeight + spacing)
            });
          }
        }
      }
    }

    const result = [];
    ideas.forEach(idea => {
      result.push(positions.get(idea.id) || {
        x: 200,
        y: 200
      });
    });

    return result;
  }

  circularOrderedLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const radius = Math.max(
      (this.bubbleWidth + spacing) * ideas.length / (2 * Math.PI),
      Math.min(this.canvasWidth, this.canvasHeight) * 0.35
    );

    const sortedIdeas = [...ideas].sort((a, b) => {
      const aConnections = (a.links?.length || 0) + (a.parent_id ? 1 : 0);
      const bConnections = (b.links?.length || 0) + (b.parent_id ? 1 : 0);
      return bConnections - aConnections;
    });

    const positions = sortedIdeas.map((idea, index) => {
      const angle = (2 * Math.PI * index) / ideas.length - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle) - this.bubbleWidth / 2,
        y: centerY + radius * Math.sin(angle) - this.bubbleHeight / 2
      };
    });

    const result = [];
    ideas.forEach(idea => {
      const sortedIndex = sortedIdeas.findIndex(i => i.id === idea.id);
      result.push(positions[sortedIndex]);
    });

    this.removeOverlaps(result);
    return result;
  }

  layeredLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const layers = this.assignLayers(ideas);
    const positions = new Map();

    const layerKeys = Object.keys(layers).sort((a, b) => parseInt(a) - parseInt(b));
    const maxLayerWidth = Math.max(...layerKeys.map(k => layers[k].length));

    layerKeys.forEach((layerKey, layerIndex) => {
      const layerIdeas = layers[layerKey];
      const sortedLayerIdeas = [...layerIdeas].sort((a, b) => {
        const ideaA = ideas.find(i => i.id === a);
        const ideaB = ideas.find(i => i.id === b);
        const aConnections = (ideaA.links?.length || 0) + (ideaA.parent_id ? 1 : 0);
        const bConnections = (ideaB.links?.length || 0) + (ideaB.parent_id ? 1 : 0);
        return bConnections - aConnections;
      });

      const layerWidth = sortedLayerIdeas.length * (this.bubbleWidth + spacing) - spacing;
      const startX = (this.canvasWidth - layerWidth) / 2;
      const y = 200 + layerIndex * (this.bubbleHeight + spacing * 1.5);

      sortedLayerIdeas.forEach((ideaId, index) => {
        positions.set(ideaId, {
          x: startX + index * (this.bubbleWidth + spacing),
          y
        });
      });
    });

    const result = [];
    ideas.forEach(idea => {
      if (positions.has(idea.id)) {
        result.push(positions.get(idea.id));
      } else {
        result.push({
          x: this.canvasWidth / 2 - this.bubbleWidth / 2,
          y: 200
        });
      }
    });

    this.removeOverlaps(result);
    return result;
  }

  hybridLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const clusters = this.detectClusters(ideas);
    const clusterGroups = {};

    Object.entries(clusters).forEach(([index, clusterId]) => {
      if (!clusterGroups[clusterId]) {
        clusterGroups[clusterId] = [];
      }
      clusterGroups[clusterId].push(ideas[parseInt(index)]);
    });

    const clusterIds = Object.keys(clusterGroups);
    const numClusters = clusterIds.length;

    const clusterPositions = [];
    const clusterRadius = Math.min(this.canvasWidth, this.canvasHeight) * 0.3;

    clusterIds.forEach((clusterId, i) => {
      const angle = (2 * Math.PI * i) / numClusters - Math.PI / 2;
      clusterPositions.push({
        x: this.canvasWidth / 2 + clusterRadius * Math.cos(angle),
        y: this.canvasHeight / 2 + clusterRadius * Math.sin(angle)
      });
    });

    const result = [];
    const clusterOffset = {};

    clusterIds.forEach((clusterId, i) => {
      const clusterIdeas = clusterGroups[clusterId];
      const clusterPos = clusterPositions[i];

      const clusterLayout = this.gridLayout(clusterIdeas, spacing * 0.7);
      const clusterCenterX = clusterLayout.reduce((sum, p) => sum + p.x, 0) / clusterLayout.length;
      const clusterCenterY = clusterLayout.reduce((sum, p) => sum + p.y, 0) / clusterLayout.length;

      clusterOffset[clusterId] = {
        x: clusterPos.x - clusterCenterX,
        y: clusterPos.y - clusterCenterY
      };
    });

    ideas.forEach(idea => {
      const ideaIndex = ideas.findIndex(i => i.id === idea.id);
      const clusterId = clusters[ideaIndex];
      const offset = clusterOffset[clusterId] || { x: 0, y: 0 };

      const clusterIdeas = clusterGroups[clusterId];
      const localIndex = clusterIdeas.findIndex(i => i.id === idea.id);
      const localLayout = this.gridLayout(clusterIdeas, spacing * 0.7);

      result.push({
        x: localLayout[localIndex].x + offset.x,
        y: localLayout[localIndex].y + offset.y
      });
    });

    this.removeOverlaps(result);
    return result;
  }

  statusLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const statusOrder = ['Draft', 'In Progress', 'Review', 'Done', 'Archived'];
    const statusGroups = {};

    ideas.forEach(idea => {
      const status = idea.status || 'Draft';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(idea);
    });

    const positions = new Map();
    let currentY = 200;

    statusOrder.forEach(status => {
      const groupIdeas = statusGroups[status];
      if (!groupIdeas || groupIdeas.length === 0) return;

      const sortedGroup = [...groupIdeas].sort((a, b) => {
        const aConnections = (a.links?.length || 0) + (a.parent_id ? 1 : 0);
        const bConnections = (b.links?.length || 0) + (b.parent_id ? 1 : 0);
        return bConnections - aConnections;
      });

      const groupedIdeas = [];
      const used = new Set();

      for (const idea of sortedGroup) {
        if (used.has(idea.id)) continue;

        const group = [idea];
        const linkedIds = new Set(idea.links || []);
        if (idea.parent_id && groupIdeas.find(i => i.id === idea.parent_id)) {
          linkedIds.add(idea.parent_id);
        }

        for (const other of sortedGroup) {
          if (used.has(other.id) || other.id === idea.id) continue;
          if (linkedIds.has(other.id)) {
            group.push(other);
            used.add(other.id);
          }
        }

        groupedIdeas.push(group);
        used.add(idea.id);
      }

      const groupWidth = sortedGroup.length * (this.bubbleWidth + spacing) - spacing;
      const startX = (this.canvasWidth - groupWidth) / 2;

      let currentIndex = 0;
      groupedIdeas.forEach(group => {
        group.forEach(idea => {
          positions.set(idea.id, {
            x: startX + currentIndex * (this.bubbleWidth + spacing),
            y: currentY
          });
          currentIndex++;
        });
      });

      currentY += this.bubbleHeight + spacing * 1.5;
    });

    const result = [];
    ideas.forEach(idea => {
      if (positions.has(idea.id)) {
        result.push(positions.get(idea.id));
      } else {
        result.push({
          x: this.canvasWidth / 2 - this.bubbleWidth / 2,
          y: 200
        });
      }
    });

    this.removeOverlaps(result);
    return result;
  }

  confidenceLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const sortedIdeas = [...ideas].sort((a, b) => (a.confidence || 50) - (b.confidence || 50));

    const columns = Math.ceil(Math.sqrt(ideas.length));
    const rows = Math.ceil(ideas.length / columns);
    const grid = Array(rows).fill(null).map(() => Array(columns).fill(null));
    const placed = new Set();
    const positions = new Map();

    const getAdjacentCells = (row, col) => {
      const adjacent = [];
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < columns) {
          adjacent.push({ row: newRow, col: newCol });
        }
      }
      return adjacent;
    };

    const findBestCell = (idea) => {
      const linkedIds = new Set(idea.links || []);
      if (idea.parent_id) linkedIds.add(idea.parent_id);

      let bestCell = null;
      let bestScore = -Infinity;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          if (grid[row][col] !== null) continue;

          let score = 0;
          const adjacent = getAdjacentCells(row, col);
          for (const adj of adjacent) {
            const adjIdea = grid[adj.row][adj.col];
            if (adjIdea && linkedIds.has(adjIdea.id)) {
              score += 10;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestCell = { row, col };
          }
        }
      }

      return bestCell;
    };

    for (const idea of sortedIdeas) {
      if (placed.has(idea.id)) continue;

      const cell = findBestCell(idea);
      if (cell) {
        grid[cell.row][cell.col] = idea;
        placed.add(idea.id);
        positions.set(idea.id, {
          x: 200 + cell.col * (this.bubbleWidth + spacing),
          y: 200 + cell.row * (this.bubbleHeight + spacing)
        });

        const linkedIds = new Set(idea.links || []);
        if (idea.parent_id) linkedIds.add(idea.parent_id);

        for (const linkedId of linkedIds) {
          if (placed.has(linkedId)) continue;
          const linkedIdea = ideas.find(i => i.id === linkedId);
          if (!linkedIdea) continue;

          const linkedCell = findBestCell(linkedIdea);
          if (linkedCell) {
            grid[linkedCell.row][linkedCell.col] = linkedIdea;
            placed.add(linkedIdea.id);
            positions.set(linkedIdea.id, {
              x: 200 + linkedCell.col * (this.bubbleWidth + spacing),
              y: 200 + linkedCell.row * (this.bubbleHeight + spacing)
            });
          }
        }
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (grid[row][col] === null) {
          const unplaced = sortedIdeas.find(i => !placed.has(i.id));
          if (unplaced) {
            grid[row][col] = unplaced;
            placed.add(unplaced.id);
            positions.set(unplaced.id, {
              x: 200 + col * (this.bubbleWidth + spacing),
              y: 200 + row * (this.bubbleHeight + spacing)
            });
          }
        }
      }
    }

    const result = [];
    ideas.forEach(idea => {
      result.push(positions.get(idea.id) || {
        x: 200,
        y: 200
      });
    });

    return result;
  }

  tagLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const tagGroups = {};

    ideas.forEach(idea => {
      const tags = idea.tags || [];
      if (tags.length === 0) {
        if (!tagGroups['Untagged']) {
          tagGroups['Untagged'] = [];
        }
        tagGroups['Untagged'].push(idea);
      } else {
        tags.forEach(tag => {
          if (!tagGroups[tag]) {
            tagGroups[tag] = [];
          }
          tagGroups[tag].push(idea);
        });
      }
    });

    const tagNames = Object.keys(tagGroups).sort();
    const positions = new Map();

    const columns = Math.ceil(Math.sqrt(tagNames.length));
    const rows = Math.ceil(tagNames.length / columns);

    tagNames.forEach((tagName, tagIndex) => {
      const tagIdeas = tagGroups[tagName];
      const tagCol = tagIndex % columns;
      const tagRow = Math.floor(tagIndex / columns);

      const tagStartX = 200 + tagCol * (this.bubbleWidth * 3 + spacing * 2);
      const tagStartY = 200 + tagRow * (this.bubbleHeight * 3 + spacing * 2);

      const sortedTagIdeas = [...tagIdeas].sort((a, b) => {
        const aConnections = (a.links?.length || 0) + (a.parent_id ? 1 : 0);
        const bConnections = (b.links?.length || 0) + (b.parent_id ? 1 : 0);
        return bConnections - aConnections;
      });

      const groupedIdeas = [];
      const used = new Set();

      for (const idea of sortedTagIdeas) {
        if (used.has(idea.id)) continue;

        const group = [idea];
        const linkedIds = new Set(idea.links || []);
        if (idea.parent_id && tagIdeas.find(i => i.id === idea.parent_id)) {
          linkedIds.add(idea.parent_id);
        }

        for (const other of sortedTagIdeas) {
          if (used.has(other.id) || other.id === idea.id) continue;
          if (linkedIds.has(other.id)) {
            group.push(other);
            used.add(other.id);
          }
        }

        groupedIdeas.push(group);
        used.add(idea.id);
      }

      let currentIndex = 0;
      groupedIdeas.forEach(group => {
        group.forEach(idea => {
          const ideaCol = currentIndex % 3;
          const ideaRow = Math.floor(currentIndex / 3);

          positions.set(idea.id, {
            x: tagStartX + ideaCol * (this.bubbleWidth + spacing),
            y: tagStartY + ideaRow * (this.bubbleHeight + spacing)
          });
          currentIndex++;
        });
      });
    });

    const result = [];
    ideas.forEach(idea => {
      if (positions.has(idea.id)) {
        result.push(positions.get(idea.id));
      } else {
        result.push({
          x: this.canvasWidth / 2 - this.bubbleWidth / 2,
          y: 200
        });
      }
    });

    this.removeOverlaps(result);
    return result;
  }

  mindMapLayout(ideas, spacing = 150) {
    if (ideas.length === 0) return [];
    if (ideas.length === 1) {
      return [{ x: this.canvasWidth / 2 - this.bubbleWidth / 2, y: 200 }];
    }

    const ideaMap = new Map();
    ideas.forEach((idea, index) => {
      ideaMap.set(idea.id, { idea, index, children: [] });
    });

    const roots = [];
    ideaMap.forEach(({ idea, children }) => {
      if (idea.parent_id && ideaMap.has(idea.parent_id)) {
        ideaMap.get(idea.parent_id).children.push(idea.id);
      } else {
        roots.push(idea.id);
      }
    });

    const positions = new Map();

    const layoutNode = (nodeId, x, y, angle, depth) => {
      const nodeData = ideaMap.get(nodeId);
      if (!nodeData) return;

      positions.set(nodeId, { x, y });

      const children = nodeData.children;
      if (children.length === 0) return;

      const radius = spacing * 1.5 + depth * 50;
      const angleStep = Math.PI / (children.length + 1);

      const sortedChildren = [...children].sort((a, b) => {
        const ideaA = ideaMap.get(a).idea;
        const ideaB = ideaMap.get(b).idea;
        const aConnections = (ideaA.links?.length || 0) + (ideaA.parent_id ? 1 : 0);
        const bConnections = (ideaB.links?.length || 0) + (ideaB.parent_id ? 1 : 0);
        return bConnections - aConnections;
      });

      const groupedChildren = [];
      const used = new Set();

      for (const childId of sortedChildren) {
        if (used.has(childId)) continue;

        const group = [childId];
        const childIdea = ideaMap.get(childId).idea;
        const linkedIds = new Set(childIdea.links || []);

        for (const otherId of sortedChildren) {
          if (used.has(otherId) || otherId === childId) continue;
          if (linkedIds.has(otherId)) {
            group.push(otherId);
            used.add(otherId);
          }
        }

        groupedChildren.push(group);
        used.add(childId);
      }

      let childIndex = 0;
      groupedChildren.forEach(group => {
        group.forEach(childId => {
          const childAngle = angle - Math.PI / 2 + angleStep * (childIndex + 1);
          const childX = x + radius * Math.cos(childAngle);
          const childY = y + radius * Math.sin(childAngle);
          layoutNode(childId, childX, childY, childAngle, depth + 1);
          childIndex++;
        });
      });
    };

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    if (roots.length === 1) {
      layoutNode(roots[0], centerX, centerY, 0, 0);
    } else {
      const rootRadius = 300;
      roots.forEach((rootId, index) => {
        const angle = (2 * Math.PI * index) / roots.length - Math.PI / 2;
        const rootX = centerX + rootRadius * Math.cos(angle);
        const rootY = centerY + rootRadius * Math.sin(angle);
        layoutNode(rootId, rootX, rootY, angle, 0);
      });
    }

    const result = [];
    ideas.forEach(idea => {
      if (positions.has(idea.id)) {
        result.push(positions.get(idea.id));
      } else {
        result.push({
          x: centerX - this.bubbleWidth / 2,
          y: centerY - this.bubbleHeight / 2
        });
      }
    });

    this.removeOverlaps(result);
    return result;
  }

  initializePositions(ideas) {
    const positions = [];
    const clusters = this.detectClusters(ideas);
    const clusterCenters = {};

    const clusterIds = Object.keys(clusters).sort((a, b) => parseInt(a) - parseInt(b));
    const numClusters = clusterIds.length;

    clusterIds.forEach((clusterId, i) => {
      const angle = (2 * Math.PI * i) / numClusters - Math.PI / 2;
      const radius = 500;
      clusterCenters[clusterId] = {
        x: this.canvasWidth / 2 + radius * Math.cos(angle),
        y: this.canvasHeight / 2 + radius * Math.sin(angle)
      };
    });

    ideas.forEach((idea, index) => {
      const clusterId = clusters[index];
      const center = clusterCenters[clusterId] || { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
      const clusterIdeas = ideas.filter((_, i) => clusters[i] === clusterId);
      const localIndex = clusterIdeas.findIndex(i => i.id === idea.id);
      const offsetAngle = (2 * Math.PI * localIndex) / clusterIdeas.length;
      const offsetRadius = 100;

      positions.push({
        x: center.x + offsetRadius * Math.cos(offsetAngle),
        y: center.y + offsetRadius * Math.sin(offsetAngle)
      });
    });

    return positions;
  }

  buildAdjacencyMatrix(ideas) {
    const n = ideas.length;
    const adjacency = Array(n).fill(null).map(() => Array(n).fill({ linked: false, isParentChild: false }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ideaA = ideas[i];
        const ideaB = ideas[j];

        const isParentChild = ideaA.parent_id === ideaB.id || ideaB.parent_id === ideaA.id;
        const isLinked = ideaA.links && ideaA.links.includes(ideaB.id);

        adjacency[i][j] = { linked: isLinked, isParentChild };
        adjacency[j][i] = { linked: isLinked, isParentChild };
      }
    }

    return adjacency;
  }

  detectClusters(ideas) {
    const n = ideas.length;
    const visited = new Set();
    const clusters = {};
    let clusterId = 0;

    const bfs = (startIndex, clusterId) => {
      const queue = [startIndex];
      visited.add(startIndex);
      clusters[startIndex] = clusterId;

      while (queue.length > 0) {
        const current = queue.shift();

        for (let i = 0; i < n; i++) {
          if (!visited.has(i)) {
            const ideaA = ideas[current];
            const ideaB = ideas[i];
            const isLinked = ideaA.links && ideaA.links.includes(ideaB.id);
            const isParentChild = ideaA.parent_id === ideaB.id || ideaB.parent_id === ideaA.id;

            if (isLinked || isParentChild) {
              visited.add(i);
              clusters[i] = clusterId;
              queue.push(i);
            }
          }
        }
      }
    };

    for (let i = 0; i < n; i++) {
      if (!visited.has(i)) {
        bfs(i, clusterId);
        clusterId++;
      }
    }

    return clusters;
  }

  assignLayers(ideas) {
    const layers = {};
    const visited = new Set();
    const ideaMap = new Map(ideas.map((idea, index) => [idea.id, { idea, index }]));

    const getLayer = (ideaId, currentLayer = 0) => {
      if (visited.has(ideaId)) return;
      visited.add(ideaId);

      const ideaData = ideaMap.get(ideaId);
      if (!ideaData) return;

      if (!layers[ideaId] || layers[ideaId] < currentLayer) {
        layers[ideaId] = currentLayer;
      }

      const idea = ideaData.idea;
      if (idea.links) {
        idea.links.forEach(linkId => {
          getLayer(linkId, currentLayer + 1);
        });
      }

      if (idea.parent_id) {
        getLayer(idea.parent_id, currentLayer - 1);
      }
    };

    ideas.forEach(idea => {
      if (!visited.has(idea.id)) {
        getLayer(idea.id, 0);
      }
    });

    const groupedLayers = {};
    Object.entries(layers).forEach(([ideaId, layer]) => {
      if (!groupedLayers[layer]) {
        groupedLayers[layer] = [];
      }
      groupedLayers[layer].push(ideaId);
    });

    return groupedLayers;
  }

  removeOverlaps(positions) {
    const maxIterations = 50;
    const padding = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
      let moved = false;

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const overlapX = (this.bubbleWidth + padding) - Math.abs(dx);
          const overlapY = (this.bubbleHeight + padding) - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            const moveX = overlapX / 2 * Math.sign(dx || 1);
            const moveY = overlapY / 2 * Math.sign(dy || 1);

            positions[i].x -= moveX;
            positions[i].y -= moveY;
            positions[j].x += moveX;
            positions[j].y += moveY;

            moved = true;
          }
        }
      }

      if (!moved) break;
    }
  }

  centerLayout(positions) {
    if (positions.length === 0) return;

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + this.bubbleWidth));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y + this.bubbleHeight));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    const canvasCenterX = this.canvasWidth / 2;
    const canvasCenterY = this.canvasHeight / 2;

    const offsetX = canvasCenterX - contentCenterX;
    const offsetY = canvasCenterY - contentCenterY;

    positions.forEach(pos => {
      pos.x += offsetX;
      pos.y += offsetY;
    });
  }

  generateLayoutPositions(ideas, algorithm = 'force-directed', spacing = 150) {
    return this.autoLayout(ideas, algorithm, spacing);
  }
}

export const layoutEngine = new LayoutEngine();
