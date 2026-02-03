import { getAllIdeas, saveIdea, deleteIdea, getDueIdeas, getSettings, saveSetting } from '../db/idb.js';
import { createIdea, isIdeaDue, getStaleDays, calculateNextReview, DEFAULT_STATUSES } from '../models/idea.js';

class AppState {
  constructor() {
    this.ideas = [];
    this.currentView = 'canvas';
    this.selectedIdeaId = null;
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterCategory = 'all';
    this.filterDueOnly = false;
    this.filterArchived = false;
    this.dueIdeas = [];
    this.settings = {
      themeIntensity: 'normal',
      bubbleFloat: true,
      defaultReviewCadence: 14,
      customStatuses: [],
      glassyAesthetic: false,
      aiApiKey: '',
      aiProvider: 'tensorix',
      aiModel: 'z-ai/glm-4.7'
    };
    this.listeners = [];
  }

  async init() {
    this.ideas = await getAllIdeas();
    this.dueIdeas = await getDueIdeas();
    const savedSettings = await getSettings();
    this.settings = { ...this.settings, ...savedSettings };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this));
  }

  getFilteredIdeas() {
    let filtered = [...this.ideas];

    if (this.filterArchived) {
      filtered = filtered.filter(idea => idea.is_archived);
    } else {
      filtered = filtered.filter(idea => !idea.is_archived);
    }

    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(idea => idea.status === this.filterStatus);
    }

    if (this.filterCategory !== 'all') {
      filtered = filtered.filter(idea => idea.category === this.filterCategory);
    }

    if (this.filterDueOnly) {
      filtered = filtered.filter(idea => isIdeaDue(idea));
    }

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(idea =>
        idea.title.toLowerCase().includes(query) ||
        idea.summary.toLowerCase().includes(query) ||
        idea.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  getCategories() {
    const categories = new Set();
    this.ideas.forEach(idea => {
      if (idea.category) {
        categories.add(idea.category);
      }
    });
    return Array.from(categories).sort();
  }

  getStatuses() {
    return [...DEFAULT_STATUSES, ...this.settings.customStatuses];
  }

  getSelectedIdea() {
    return this.ideas.find(idea => idea.id === this.selectedIdeaId);
  }

  async createIdea(data) {
    const newIdea = createIdea(data);
    await saveIdea(newIdea);
    this.ideas.push(newIdea);
    this.selectedIdeaId = newIdea.id;
    this.currentView = 'detail';
    this.notify();
    return newIdea;
  }

  async updateIdea(idea) {
    idea.updated_at = Date.now();
    await saveIdea(idea);
    const index = this.ideas.findIndex(i => i.id === idea.id);
    if (index !== -1) {
      this.ideas[index] = idea;
    }
    this.notify();
  }

  async deleteIdea(id) {
    await deleteIdea(id);
    this.ideas = this.ideas.filter(idea => idea.id !== id);
    if (this.selectedIdeaId === id) {
      this.selectedIdeaId = null;
      this.currentView = 'canvas';
    }
    this.notify();
  }

  async clearAllIdeas() {
    const { deleteIdea: dbDeleteIdea } = await import('../db/idb.js');
    
    for (const idea of this.ideas) {
      await dbDeleteIdea(idea.id);
    }
    
    this.ideas = [];
    this.selectedIdeaId = null;
    this.currentView = 'canvas';
    this.notify();
  }

  async archiveIdea(id) {
    const idea = this.ideas.find(i => i.id === id);
    if (idea) {
      idea.is_archived = true;
      await this.updateIdea(idea);
    }
  }

  async unarchiveIdea(id) {
    const idea = this.ideas.find(i => i.id === id);
    if (idea) {
      idea.is_archived = false;
      await this.updateIdea(idea);
    }
  }

  async submitReview(ideaId, reviewData) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (!idea) return;

    const { createReview } = await import('../models/idea.js');
    const { calculateSuggestedConfidence } = await import('../utils/confidence.js');

    const review = createReview({
      idea_id: ideaId,
      answers: reviewData.answers,
      confidence_before: idea.confidence,
      system_suggested_confidence: calculateSuggestedConfidence(idea, reviewData).suggested,
      confidence_after: reviewData.confidence_after,
      user_adjusted: reviewData.user_adjusted,
      mood: reviewData.mood,
      notes: reviewData.notes
    });

    idea.reviews.push(review);
    idea.last_reviewed_at = review.created_at;
    idea.confidence = reviewData.confidence_after;
    idea.next_review_at = calculateNextReview(idea);
    idea.ignored_count = 0;

    if (reviewData.new_status) {
      idea.status = reviewData.new_status;
    }

    if (reviewData.next_step) {
      const { createNextStep } = await import('../models/idea.js');
      idea.next_steps.push(createNextStep({ text: reviewData.next_step }));
    }

    await this.updateIdea(idea);
    this.dueIdeas = this.dueIdeas.filter(i => i.id !== ideaId);
  }

  async snoozeIdea(ideaId, days) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (!idea) return;

    idea.ignored_count += 1;
    idea.next_review_at = Date.now() + (days * 24 * 60 * 60 * 1000);
    await this.updateIdea(idea);
    this.dueIdeas = this.dueIdeas.filter(i => i.id !== ideaId);
  }

  async mergeIdeas(ideaIdA, ideaIdB, mergedData) {
    const ideaA = this.ideas.find(i => i.id === ideaIdA);
    const ideaB = this.ideas.find(i => i.id === ideaIdB);
    if (!ideaA || !ideaB) return;

    const mergedIdea = createIdea({
      title: mergedData.title,
      summary: mergedData.summary,
      merged_from: [ideaIdA, ideaIdB],
      status: ideaA.status,
      confidence: Math.round((ideaA.confidence + ideaB.confidence) / 2),
      reviews: [...ideaA.reviews, ...ideaB.reviews],
      assumptions: [...ideaA.assumptions, ...ideaB.assumptions],
      open_questions: [...ideaA.open_questions, ...ideaB.open_questions],
      next_steps: [...ideaA.next_steps, ...ideaB.next_steps],
      tags: [...new Set([...ideaA.tags, ...ideaB.tags])],
      canvas_pos: {
        x: (ideaA.canvas_pos.x + ideaB.canvas_pos.x) / 2,
        y: (ideaA.canvas_pos.y + ideaB.canvas_pos.y) / 2
      }
    });

    await saveIdea(mergedIdea);
    this.ideas.push(mergedIdea);

    ideaA.is_archived = true;
    ideaB.is_archived = true;
    await this.updateIdea(ideaA);
    await this.updateIdea(ideaB);

    this.selectedIdeaId = mergedIdea.id;
    this.currentView = 'detail';
    this.notify();
  }

  async splitIdea(ideaId) {
    const mergedIdea = this.ideas.find(i => i.id === ideaId);
    if (!mergedIdea || !mergedIdea.merged_from || mergedIdea.merged_from.length === 0) return;

    const originalIdeaIds = mergedIdea.merged_from;
    const originalIdeas = originalIdeaIds.map(id => this.ideas.find(i => i.id === id)).filter(Boolean);

    if (originalIdeas.length === 0) return;

    for (const originalIdea of originalIdeas) {
      originalIdea.is_archived = false;
      await this.updateIdea(originalIdea);
    }

    await this.deleteIdea(ideaId);
    this.selectedIdeaId = originalIdeas[0].id;
    this.currentView = 'detail';
    this.notify();
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    for (const [key, value] of Object.entries(newSettings)) {
      await saveSetting(key, value);
    }
    this.notify();
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    this.notify();
  }

  setFilterStatus(status) {
    this.filterStatus = status;
    this.notify();
  }

  setFilterCategory(category) {
    this.filterCategory = category;
    this.notify();
  }

  setFilterDueOnly(dueOnly) {
    this.filterDueOnly = dueOnly;
    this.notify();
  }

  setFilterArchived(archived) {
    this.filterArchived = archived;
    this.notify();
  }

  setCurrentView(view) {
    this.currentView = view;
    this.notify();
  }

  setSelectedIdeaId(id) {
    this.selectedIdeaId = id;
    if (id) {
      this.currentView = 'detail';
    }
    this.notify();
  }

  async refreshDueIdeas() {
    this.dueIdeas = await getDueIdeas();
    this.notify();
  }

  async importIdeasFromAI(aiIdeas) {
    const createdIdeas = [];
    const titleToIdMap = {};
    const positions = this.generateLayoutPositions(aiIdeas);

    for (let i = 0; i < aiIdeas.length; i++) {
      const aiIdea = aiIdeas[i];
      const newIdea = createIdea({
        title: aiIdea.title,
        summary: aiIdea.summary || '',
        confidence: aiIdea.confidence || 50,
        status: aiIdea.status || 'New',
        color_variant: aiIdea.color_variant || 'primary',
        tags: aiIdea.tags || [],
        canvas_pos: positions[i]
      });

      await saveIdea(newIdea);
      this.ideas.push(newIdea);
      createdIdeas.push(newIdea);
      titleToIdMap[aiIdea.title] = newIdea.id;
    }

    for (let i = 0; i < createdIdeas.length; i++) {
      const createdIdea = createdIdeas[i];
      const aiIdea = aiIdeas[i];

      if (aiIdea.parent && titleToIdMap[aiIdea.parent]) {
        createdIdea.parent_id = titleToIdMap[aiIdea.parent];
      }

      if (aiIdea.related_to && aiIdea.related_to.length > 0) {
        createdIdea.links = aiIdea.related_to
          .map(title => titleToIdMap[title])
          .filter(id => id && id !== createdIdea.id);
      }

      await saveIdea(createdIdea);
    }

    this.notify();
    return createdIdeas;
  }

  generateLayoutPositions(ideas, layoutType = 'row') {
    const count = ideas.length;
    const bubbleWidth = 260;
    const bubbleHeight = 160;
    const canvasWidth = 5000;
    const canvasHeight = 4000;

    if (count === 0) return [];

    if (count === 1) {
      return [{ x: canvasWidth / 2 - bubbleWidth / 2, y: canvasHeight / 2 - bubbleHeight / 2 }];
    }

    const idToIdea = new Map();
    ideas.forEach(idea => idToIdea.set(idea.id, idea));

    const getChildren = (ideaId) => {
      return ideas.filter(child => child.parent_id === ideaId);
    };

    const getSubtreeWidth = (ideaId) => {
      const children = getChildren(ideaId);
      if (children.length === 0) return bubbleWidth;
      let totalWidth = 0;
      children.forEach(child => {
        totalWidth += getSubtreeWidth(child.id) + 40;
      });
      totalWidth -= 40;
      return Math.max(bubbleWidth, totalWidth);
    };

    const getSubtreeHeight = (ideaId) => {
      const children = getChildren(ideaId);
      if (children.length === 0) return bubbleHeight;
      let maxChildHeight = 0;
      children.forEach(child => {
        const childHeight = getSubtreeHeight(child.id);
        maxChildHeight = Math.max(maxChildHeight, childHeight);
      });
      return bubbleHeight + 140 + maxChildHeight;
    };

    const getDepth = (ideaId) => {
      const children = getChildren(ideaId);
      if (children.length === 0) return 0;
      return 1 + Math.max(...children.map(c => getDepth(c.id)));
    };

    const getSubtreeSize = (ideaId) => {
      const children = getChildren(ideaId);
      if (children.length === 0) return 1;
      return 1 + children.reduce((sum, c) => sum + getSubtreeSize(c.id), 0);
    };

    const getSubtreeRoot = (ideaId) => {
      const idea = idToIdea.get(ideaId);
      if (!idea) return null;
      if (!idea.parent_id) return ideaId;
      return getSubtreeRoot(idea.parent_id);
    };

    const getCrossSubtreeConnections = () => {
      const connections = new Map();
      ideas.forEach(idea => {
        if (idea.links && idea.links.length > 0) {
          const rootA = getSubtreeRoot(idea.id);
          idea.links.forEach(linkId => {
            const linkedIdea = idToIdea.get(linkId);
            if (linkedIdea) {
              const rootB = getSubtreeRoot(linkId);
              if (rootA && rootB && rootA !== rootB) {
                const key = [rootA, rootB].sort().join('-');
                if (!connections.has(key)) {
                  connections.set(key, { rootA, rootB, count: 0, pairs: [] });
                }
                connections.get(key).count++;
                connections.get(key).pairs.push({ ideaA: idea.id, ideaB: linkId });
              }
            }
          });
        }
      });
      return connections;
    };

    const getTreeConnectionScore = (treeA, treeB, connections) => {
      const key = [treeA.id, treeB.id].sort().join('-');
      const conn = connections.get(key);
      return conn ? conn.count : 0;
    };

    const optimizeTreeOrder = (trees, connections) => {
      if (trees.length <= 2) return trees;

      const bestOrder = [...trees];
      let bestScore = -Infinity;

      const calculateScore = (order) => {
        let score = 0;
        for (let i = 0; i < order.length - 1; i++) {
          score += getTreeConnectionScore(order[i], order[i + 1], connections);
        }
        return score;
      };

      const swap = (arr, i, j) => {
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      };

      for (let iter = 0; iter < 100; iter++) {
        const currentOrder = [...bestOrder];
        const i = Math.floor(Math.random() * currentOrder.length);
        const j = Math.floor(Math.random() * currentOrder.length);
        swap(currentOrder, i, j);

        const currentScore = calculateScore(currentOrder);
        if (currentScore > bestScore) {
          bestScore = currentScore;
          for (let k = 0; k < currentOrder.length; k++) {
            bestOrder[k] = currentOrder[k];
          }
        }
      }

      return bestOrder;
    };

    if (layoutType === 'row') {
      const positions = new Map();
      const horizontalGap = 40;
      const verticalGap = 140;

      const layoutSubtree = (ideaId, rootX, rootY) => {
        const idea = idToIdea.get(ideaId);
        if (!idea) return;

        const children = getChildren(ideaId);
        const subtreeWidth = getSubtreeWidth(ideaId);

        const x = rootX - bubbleWidth / 2;
        const y = rootY;
        positions.set(ideaId, { x, y });

        if (children.length === 0) return;

        const childY = rootY + bubbleHeight + verticalGap;
        let childX = rootX - subtreeWidth / 2;

        children.forEach(child => {
          const childWidth = getSubtreeWidth(child.id);
          const childCenterX = childX + childWidth / 2;
          layoutSubtree(child.id, childCenterX, childY);
          childX += childWidth + horizontalGap;
        });
      };

      const topLevelIdeas = ideas.filter(i => !i.parent_id);
      const rowHeight = Math.max(...topLevelIdeas.map(i => getSubtreeHeight(i.id))) + 100;
      const maxRowWidth = canvasWidth - 200;
      const treesPerRow = Math.max(1, Math.floor(maxRowWidth / 600));

      const crossConnections = getCrossSubtreeConnections();
      const orderedTrees = optimizeTreeOrder(topLevelIdeas, crossConnections);

      let currentX = 100;
      let currentY = 100;

      orderedTrees.forEach((idea, index) => {
        const treeWidth = getSubtreeWidth(idea.id);
        if (currentX + treeWidth > maxRowWidth && index > 0) {
          currentX = 100;
          currentY += rowHeight;
        }
        layoutSubtree(idea.id, currentX + treeWidth / 2, currentY);
        currentX += treeWidth + 100;
      });

      const result = [];
      ideas.forEach(idea => {
        if (positions.has(idea.id)) {
          result.push(positions.get(idea.id));
        } else {
          result.push({
            x: Math.random() * (canvasWidth - bubbleWidth - 100) + 50,
            y: Math.random() * (canvasHeight - bubbleHeight - 100) + 50
          });
        }
      });

      const adjustForCrossConnections = (positions) => {
        const adjusted = positions.map(p => ({ ...p }));
        const idToIndex = new Map();
        ideas.forEach((idea, i) => idToIndex.set(idea.id, i));

        const originalPositions = positions.map(p => ({ ...p }));

        const iterations = 30;
        const attractionStrength = 0.05;
        const maxMove = 50;

        const checkCollision = (idx, newX, newY) => {
          const minX = newX;
          const maxX = newX + bubbleWidth;
          const minY = newY;
          const maxY = newY + bubbleHeight;

          for (let i = 0; i < adjusted.length; i++) {
            if (i === idx) continue;

            const other = adjusted[i];
            const otherMinX = other.x;
            const otherMaxX = other.x + bubbleWidth;
            const otherMinY = other.y;
            const otherMaxY = other.y + bubbleHeight;

            if (minX < otherMaxX && maxX > otherMinX &&
                minY < otherMaxY && maxY > otherMinY) {
              return true;
            }
          }
          return false;
        };

        const clampMove = (idx, newX, newY) => {
          const orig = originalPositions[idx];
          const maxDist = maxMove;

          const dx = newX - orig.x;
          const dy = newY - orig.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxDist) {
            const ratio = maxDist / dist;
            return {
              x: orig.x + dx * ratio,
              y: orig.y + dy * ratio
            };
          }

          return { x: newX, y: newY };
        };

        for (let iter = 0; iter < iterations; iter++) {
          ideas.forEach(idea => {
            if (idea.links && idea.links.length > 0) {
              const idxA = idToIndex.get(idea.id);
              const posA = adjusted[idxA];

              idea.links.forEach(linkId => {
                const linkedIdea = idToIdea.get(linkId);
                if (linkedIdea) {
                  const rootA = getSubtreeRoot(idea.id);
                  const rootB = getSubtreeRoot(linkId);

                  if (rootA && rootB && rootA !== rootB) {
                    const idxB = idToIndex.get(linkId);
                    const posB = adjusted[idxB];

                    const dx = posB.x - posA.x;
                    const dy = posB.y - posA.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                      const moveX = dx * attractionStrength;
                      const moveY = dy * attractionStrength;

                      const newAX = posA.x + moveX;
                      const newAY = posA.y + moveY;
                      const newBX = posB.x - moveX;
                      const newBY = posB.y - moveY;

                      const clampedA = clampMove(idxA, newAX, newAY);
                      const clampedB = clampMove(idxB, newBX, newBY);

                      if (!checkCollision(idxA, clampedA.x, clampedA.y)) {
                        adjusted[idxA].x = clampedA.x;
                        adjusted[idxA].y = clampedA.y;
                      }

                      if (!checkCollision(idxB, clampedB.x, clampedB.y)) {
                        adjusted[idxB].x = clampedB.x;
                        adjusted[idxB].y = clampedB.y;
                      }
                    }
                  }
                }
              });
            }
          });
        }

        return adjusted;
      };

      return adjustForCrossConnections(result);
    }

    if (layoutType === 'radial') {
      const positions = new Map();
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      const topLevelIdeas = ideas.filter(i => !i.parent_id);

      const crossConnections = getCrossSubtreeConnections();
      const orderedTrees = optimizeTreeOrder(topLevelIdeas, crossConnections);

      const innerRadius = Math.min(canvasWidth, canvasHeight) * 0.08;
      const outerRadius = Math.min(canvasWidth, canvasHeight) * 0.22;

      const innerAngleStep = (2 * Math.PI) / orderedTrees.length;
      orderedTrees.forEach((idea, index) => {
        const angle = index * innerAngleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * innerRadius - bubbleWidth / 2;
        const y = centerY + Math.sin(angle) * innerRadius - bubbleHeight / 2;
        positions.set(idea.id, { x, y });
      });

      orderedTrees.forEach((parent, parentIndex) => {
        const children = getChildren(parent.id);
        if (children.length === 0) return;

        const parentAngle = parentIndex * innerAngleStep - Math.PI / 2;
        const angleRange = innerAngleStep * 0.6;
        const startAngle = parentAngle - angleRange / 2;
        const angleStep = children.length > 1 ? angleRange / (children.length - 1) : 0;

        children.forEach((child, childIndex) => {
          const childAngle = children.length === 1 ? parentAngle : startAngle + childIndex * angleStep;
          const x = centerX + Math.cos(childAngle) * outerRadius - bubbleWidth / 2;
          const y = centerY + Math.sin(childAngle) * outerRadius - bubbleHeight / 2;
          positions.set(child.id, { x, y });
        });
      });

      const result = [];
      ideas.forEach(idea => {
        if (positions.has(idea.id)) {
          result.push(positions.get(idea.id));
        } else {
          result.push({
            x: Math.random() * (canvasWidth - bubbleWidth - 100) + 50,
            y: Math.random() * (canvasHeight - bubbleHeight - 100) + 50
          });
        }
      });

      const adjustForCrossConnections = (positions) => {
        const adjusted = positions.map(p => ({ ...p }));
        const idToIndex = new Map();
        ideas.forEach((idea, i) => idToIndex.set(idea.id, i));

        const originalPositions = positions.map(p => ({ ...p }));

        const iterations = 30;
        const attractionStrength = 0.05;
        const maxMove = 50;

        const checkCollision = (idx, newX, newY) => {
          const minX = newX;
          const maxX = newX + bubbleWidth;
          const minY = newY;
          const maxY = newY + bubbleHeight;

          for (let i = 0; i < adjusted.length; i++) {
            if (i === idx) continue;

            const other = adjusted[i];
            const otherMinX = other.x;
            const otherMaxX = other.x + bubbleWidth;
            const otherMinY = other.y;
            const otherMaxY = other.y + bubbleHeight;

            if (minX < otherMaxX && maxX > otherMinX &&
                minY < otherMaxY && maxY > otherMinY) {
              return true;
            }
          }
          return false;
        };

        const clampMove = (idx, newX, newY) => {
          const orig = originalPositions[idx];
          const maxDist = maxMove;

          const dx = newX - orig.x;
          const dy = newY - orig.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxDist) {
            const ratio = maxDist / dist;
            return {
              x: orig.x + dx * ratio,
              y: orig.y + dy * ratio
            };
          }

          return { x: newX, y: newY };
        };

        for (let iter = 0; iter < iterations; iter++) {
          ideas.forEach(idea => {
            if (idea.links && idea.links.length > 0) {
              const idxA = idToIndex.get(idea.id);
              const posA = adjusted[idxA];

              idea.links.forEach(linkId => {
                const linkedIdea = idToIdea.get(linkId);
                if (linkedIdea) {
                  const rootA = getSubtreeRoot(idea.id);
                  const rootB = getSubtreeRoot(linkId);

                  if (rootA && rootB && rootA !== rootB) {
                    const idxB = idToIndex.get(linkId);
                    const posB = adjusted[idxB];

                    const dx = posB.x - posA.x;
                    const dy = posB.y - posA.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                      const moveX = dx * attractionStrength;
                      const moveY = dy * attractionStrength;

                      const newAX = posA.x + moveX;
                      const newAY = posA.y + moveY;
                      const newBX = posB.x - moveX;
                      const newBY = posB.y - moveY;

                      const clampedA = clampMove(idxA, newAX, newAY);
                      const clampedB = clampMove(idxB, newBX, newBY);

                      if (!checkCollision(idxA, clampedA.x, clampedA.y)) {
                        adjusted[idxA].x = clampedA.x;
                        adjusted[idxA].y = clampedA.y;
                      }

                      if (!checkCollision(idxB, clampedB.x, clampedB.y)) {
                        adjusted[idxB].x = clampedB.x;
                        adjusted[idxB].y = clampedB.y;
                      }
                    }
                  }
                }
              });
            }
          });
        }

        return adjusted;
      };

      return adjustForCrossConnections(result);
    }

    if (layoutType === 'vessel') {
      const positions = new Map();
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      const levelGroups = new Map();

      const collectLevels = (ideaId, depth) => {
        if (!levelGroups.has(depth)) {
          levelGroups.set(depth, []);
        }
        levelGroups.get(depth).push(ideaId);

        const children = getChildren(ideaId);
        children.forEach(child => collectLevels(child.id, depth + 1));
      };

      const topLevelIdeas = ideas.filter(i => !i.parent_id);
      topLevelIdeas.forEach(idea => collectLevels(idea.id, 0));

      const maxDepth = Math.max(...levelGroups.keys());
      const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.08;
      const radiusIncrement = Math.min(canvasWidth, canvasHeight) * 0.12;

      const crossConnections = getCrossSubtreeConnections();

      const getIdeaConnectionScore = (idA, idB) => {
        const ideaA = idToIdea.get(idA);
        const ideaB = idToIdea.get(idB);
        let score = 0;

        if (ideaA.links && ideaA.links.includes(idB)) score += 2;
        if (ideaB.links && ideaB.links.includes(idA)) score += 2;

        const rootA = getSubtreeRoot(idA);
        const rootB = getSubtreeRoot(idB);
        if (rootA && rootB && rootA !== rootB) {
          const key = [rootA, rootB].sort().join('-');
          const conn = crossConnections.get(key);
          if (conn) score += conn.count;
        }

        return score;
      };

      const optimizeLevelOrder = (ideaIds) => {
        if (ideaIds.length <= 2) return ideaIds;

        const bestOrder = [...ideaIds];
        let bestScore = -Infinity;

        const calculateScore = (order) => {
          let score = 0;
          for (let i = 0; i < order.length - 1; i++) {
            score += getIdeaConnectionScore(order[i], order[i + 1]);
          }
          return score;
        };

        const swap = (arr, i, j) => {
          const temp = arr[i];
          arr[i] = arr[j];
          arr[j] = temp;
        };

        for (let iter = 0; iter < 100; iter++) {
          const currentOrder = [...bestOrder];
          const i = Math.floor(Math.random() * currentOrder.length);
          const j = Math.floor(Math.random() * currentOrder.length);
          swap(currentOrder, i, j);

          const currentScore = calculateScore(currentOrder);
          if (currentScore > bestScore) {
            bestScore = currentScore;
            for (let k = 0; k < currentOrder.length; k++) {
              bestOrder[k] = currentOrder[k];
            }
          }
        }

        return bestOrder;
      };

      levelGroups.forEach((ideaIds, depth) => {
        const orderedIds = optimizeLevelOrder(ideaIds);
        const radius = baseRadius + depth * radiusIncrement;
        const angleStep = (2 * Math.PI) / orderedIds.length;

        orderedIds.forEach((ideaId, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + Math.cos(angle) * radius - bubbleWidth / 2;
          const y = centerY + Math.sin(angle) * radius - bubbleHeight / 2;
          positions.set(ideaId, { x, y });
        });
      });

      const result = [];
      ideas.forEach(idea => {
        if (positions.has(idea.id)) {
          result.push(positions.get(idea.id));
        } else {
          result.push({
            x: Math.random() * (canvasWidth - bubbleWidth - 100) + 50,
            y: Math.random() * (canvasHeight - bubbleHeight - 100) + 50
          });
        }
      });

      const adjustForCrossConnections = (positions) => {
        const adjusted = positions.map(p => ({ ...p }));
        const idToIndex = new Map();
        ideas.forEach((idea, i) => idToIndex.set(idea.id, i));

        const originalPositions = positions.map(p => ({ ...p }));

        const iterations = 30;
        const attractionStrength = 0.05;
        const maxMove = 50;

        const checkCollision = (idx, newX, newY) => {
          const minX = newX;
          const maxX = newX + bubbleWidth;
          const minY = newY;
          const maxY = newY + bubbleHeight;

          for (let i = 0; i < adjusted.length; i++) {
            if (i === idx) continue;

            const other = adjusted[i];
            const otherMinX = other.x;
            const otherMaxX = other.x + bubbleWidth;
            const otherMinY = other.y;
            const otherMaxY = other.y + bubbleHeight;

            if (minX < otherMaxX && maxX > otherMinX &&
                minY < otherMaxY && maxY > otherMinY) {
              return true;
            }
          }
          return false;
        };

        const clampMove = (idx, newX, newY) => {
          const orig = originalPositions[idx];
          const maxDist = maxMove;

          const dx = newX - orig.x;
          const dy = newY - orig.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxDist) {
            const ratio = maxDist / dist;
            return {
              x: orig.x + dx * ratio,
              y: orig.y + dy * ratio
            };
          }

          return { x: newX, y: newY };
        };

        for (let iter = 0; iter < iterations; iter++) {
          ideas.forEach(idea => {
            if (idea.links && idea.links.length > 0) {
              const idxA = idToIndex.get(idea.id);
              const posA = adjusted[idxA];

              idea.links.forEach(linkId => {
                const linkedIdea = idToIdea.get(linkId);
                if (linkedIdea) {
                  const rootA = getSubtreeRoot(idea.id);
                  const rootB = getSubtreeRoot(linkId);

                  if (rootA && rootB && rootA !== rootB) {
                    const idxB = idToIndex.get(linkId);
                    const posB = adjusted[idxB];

                    const dx = posB.x - posA.x;
                    const dy = posB.y - posA.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                      const moveX = dx * attractionStrength;
                      const moveY = dy * attractionStrength;

                      const newAX = posA.x + moveX;
                      const newAY = posA.y + moveY;
                      const newBX = posB.x - moveX;
                      const newBY = posB.y - moveY;

                      const clampedA = clampMove(idxA, newAX, newAY);
                      const clampedB = clampMove(idxB, newBX, newBY);

                      if (!checkCollision(idxA, clampedA.x, clampedA.y)) {
                        adjusted[idxA].x = clampedA.x;
                        adjusted[idxA].y = clampedA.y;
                      }

                      if (!checkCollision(idxB, clampedB.x, clampedB.y)) {
                        adjusted[idxB].x = clampedB.x;
                        adjusted[idxB].y = clampedB.y;
                      }
                    }
                  }
                }
              });
            }
          });
        }

        return adjusted;
      };

      return adjustForCrossConnections(result);
    }

    const idToIndex = new Map();
    ideas.forEach((idea, i) => idToIndex.set(idea.id, i));

    const nodes = ideas.map((idea, i) => ({
      id: idea.id,
      x: Math.random() * (canvasWidth - bubbleWidth) + bubbleWidth / 2,
      y: Math.random() * (canvasHeight - bubbleHeight) + bubbleHeight / 2,
      vx: 0,
      vy: 0,
      mass: 1,
      isRoot: !idea.parent_id
    }));

    const edges = [];
    const processedLinks = new Set();

    ideas.forEach(idea => {
      if (idea.parent_id && idToIndex.has(idea.parent_id)) {
        edges.push({
          source: idToIndex.get(idea.parent_id),
          target: idToIndex.get(idea.id),
          type: 'parent',
          strength: 0.8
        });
      }

      if (idea.links && idea.links.length > 0) {
        idea.links.forEach(linkId => {
          const linkKey = [idea.id, linkId].sort().join('-');
          if (!processedLinks.has(linkKey) && idToIndex.has(linkId)) {
            processedLinks.add(linkKey);
            const isParentChild = idea.parent_id === linkId || ideas.find(i => i.id === linkId)?.parent_id === idea.id;
            if (!isParentChild) {
              edges.push({
                source: idToIndex.get(idea.id),
                target: idToIndex.get(linkId),
                type: 'peer',
                strength: 0.3
              });
            }
          }
        });
      }
    });

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const repulsionStrength = 50000;
    const idealDistance = 200;
    const centerGravity = 0.01;
    const damping = 0.85;
    const maxVelocity = 50;
    const iterations = 300;

    for (let iter = 0; iter < iterations; iter++) {
      const temperature = 1 - iter / iterations;

      for (let i = 0; i < nodes.length; i++) {
        nodes[i].fx = 0;
        nodes[i].fy = 0;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq) || 1;

          const minDist = Math.max(bubbleWidth, bubbleHeight) * 1.2;
          if (dist < minDist) {
            const force = (minDist - dist) / minDist * 100;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].fx -= fx;
            nodes[i].fy -= fy;
            nodes[j].fx += fx;
            nodes[j].fy += fy;
          }

          const repulsion = repulsionStrength / distSq;
          nodes[i].fx -= (dx / dist) * repulsion;
          nodes[i].fy -= (dy / dist) * repulsion;
          nodes[j].fx += (dx / dist) * repulsion;
          nodes[j].fy += (dy / dist) * repulsion;
        }
      }

      edges.forEach(edge => {
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const targetDist = edge.type === 'parent' ? idealDistance * 0.7 : idealDistance * 1.5;
        const force = (dist - targetDist) * edge.strength * 0.05;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        source.fx += fx;
        source.fy += fy;
        target.fx -= fx;
        target.fy -= fy;
      });

      nodes.forEach(node => {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.fx += dx * centerGravity;
        node.fy += dy * centerGravity;
      });

      nodes.forEach(node => {
        node.vx = (node.vx + node.fx) * damping;
        node.vy = (node.vy + node.fy) * damping;

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > maxVelocity) {
          node.vx = (node.vx / speed) * maxVelocity;
          node.vy = (node.vy / speed) * maxVelocity;
        }

        node.vx *= temperature;
        node.vy *= temperature;

        node.x += node.vx;
        node.y += node.vy;

        node.x = Math.max(bubbleWidth / 2, Math.min(canvasWidth - bubbleWidth / 2, node.x));
        node.y = Math.max(bubbleHeight / 2, Math.min(canvasHeight - bubbleHeight / 2, node.y));
      });
    }

    return nodes.map(node => ({
      x: node.x - bubbleWidth / 2,
      y: node.y - bubbleHeight / 2
    }));
  }

  setAIApiKey(apiKey) {
    this.settings.aiApiKey = apiKey;
    this.updateSettings({ aiApiKey: apiKey });
  }

  async getAIService() {
    if (!this.settings.aiApiKey) {
      throw new Error('AI API key not configured');
    }

    const { createAIService } = await import('../services/ai_service.js');
    return createAIService({
      provider: this.settings.aiProvider,
      apiKey: this.settings.aiApiKey,
      model: this.settings.aiModel
    });
  }
}

export const appState = new AppState();
