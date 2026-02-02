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
      customStatuses: []
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
}

export const appState = new AppState();
