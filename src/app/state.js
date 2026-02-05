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
    this.currentLayoutAlgorithm = 'layered';
    this.currentLayoutSpacing = 150;
    this.settings = {
      bubbleFloat: true,
      defaultReviewCadence: 14,
      customStatuses: [],
      glassyAesthetic: false,
      aiApiKey: '',
      aiProvider: 'tensorix'
    };
    this.listeners = [];
  }

  async init() {
    this.ideas = await getAllIdeas();
    console.log('App init - Loaded ideas:', this.ideas.map(i => ({ title: i.title, pos: i.canvas_pos })));
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

    for (let i = 0; i < aiIdeas.length; i++) {
      const aiIdea = aiIdeas[i];
      const newIdea = createIdea({
        title: aiIdea.title,
        summary: aiIdea.summary || '',
        confidence: aiIdea.confidence || 50,
        status: aiIdea.status || 'New',
        color_variant: aiIdea.color_variant || 'primary',
        tags: aiIdea.tags || [],
        canvas_pos: { x: 0, y: 0 },
        is_ai_suggestion: aiIdea.is_ai_suggestion || false,
        suggestion_type: aiIdea.suggestion_type || null,
        suggestion_reason: aiIdea.suggestion_reason || null
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

    const positions = await this.generateLayoutPositions(createdIdeas, 'layered', 150);
    for (let i = 0; i < createdIdeas.length; i++) {
      createdIdeas[i].canvas_pos = positions[i];
      await saveIdea(createdIdeas[i]);
    }

    this.notify();
    return createdIdeas;
  }

  async generateLayoutPositions(ideas, algorithm = 'force-directed', spacing = 150) {
    const { layoutEngine } = await import('../utils/layout_engine.js');
    return layoutEngine.autoLayout(ideas, algorithm, spacing);
  }

  async autoLayoutCanvas(algorithm = 'force-directed', spacing = 150) {
    const ideas = this.getFilteredIdeas();
    const positions = await this.generateLayoutPositions(ideas, algorithm, spacing);

    for (let i = 0; i < ideas.length; i++) {
      ideas[i].canvas_pos = positions[i];
      await this.updateIdea(ideas[i]);
    }

    this.notify();
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
      apiKey: this.settings.aiApiKey
    });
  }

  async acceptSuggestion(ideaId) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (!idea || !idea.is_ai_suggestion) return;

    switch (idea.suggestion_type) {
      case 'improvement':
        if (idea.suggestion_target_id) {
          const targetIdea = this.ideas.find(i => i.id === idea.suggestion_target_id);
          if (targetIdea) {
            targetIdea.summary += '\n\n' + idea.summary;
            await this.updateIdea(targetIdea);
          }
        }
        await this.deleteIdea(ideaId);
        break;
      case 'connection':
        if (idea.suggestion_target_id) {
          const targetIdea = this.ideas.find(i => i.id === idea.suggestion_target_id);
          if (targetIdea && !targetIdea.links.includes(ideaId)) {
            targetIdea.links.push(ideaId);
            idea.links.push(targetIdea.id);
            await this.updateIdea(targetIdea);
          }
        }
        idea.is_ai_suggestion = false;
        idea.suggestion_type = null;
        idea.suggestion_reason = null;
        idea.suggestion_target_id = null;
        await this.updateIdea(idea);
        break;
      case 'new_idea':
        idea.is_ai_suggestion = false;
        idea.suggestion_type = null;
        idea.suggestion_reason = null;
        idea.suggestion_target_id = null;
        await this.updateIdea(idea);
        break;
      case 'merge':
        if (idea.suggestion_target_id) {
          await this.mergeIdeas(ideaId, idea.suggestion_target_id, {
            title: idea.title,
            summary: idea.summary
          });
        }
        break;
    }
  }

  async dismissSuggestion(ideaId) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (!idea || !idea.is_ai_suggestion) return;

    await this.deleteIdea(ideaId);
  }
}

export const appState = new AppState();
