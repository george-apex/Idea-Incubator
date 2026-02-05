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
      case 'circular':
        return this.circularLayout(ideas, spacing);
      case 'grid':
        return this.gridLayout(ideas, spacing);
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

      const levelWidth = children.length * (this.bubbleWidth + spacing) - spacing;
      const startX = (this.canvasWidth - levelWidth) / 2;

      children.forEach((childId, index) => {
        const x = startX + index * (this.bubbleWidth + spacing);
        const y = currentY;
        positions.set(childId, { x, y });

        const childData = ideaMap.get(childId);
        if (childData.children.length > 0) {
          currentY += spacing * 1.5;
          layoutLevel(childId, level + 1);
        }
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

    const columns = Math.ceil(Math.sqrt(ideas.length));
    const positions = [];

    ideas.forEach((idea, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 200 + col * (this.bubbleWidth + spacing);
      const y = 200 + row * (this.bubbleHeight + spacing);
      positions.push({ x, y });
    });

    return positions;
  }

  initializePositions(ideas) {
    const positions = [];
    const clusters = this.detectClusters(ideas);
    const clusterCenters = {};

    Object.keys(clusters).forEach(clusterId => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * 500 + 300;
      clusterCenters[clusterId] = {
        x: this.canvasWidth / 2 + radius * Math.cos(angle),
        y: this.canvasHeight / 2 + radius * Math.sin(angle)
      };
    });

    ideas.forEach((idea, index) => {
      const clusterId = clusters[index];
      const center = clusterCenters[clusterId] || { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
      positions.push({
        x: center.x + (Math.random() - 0.5) * 200,
        y: center.y + (Math.random() - 0.5) * 200
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
