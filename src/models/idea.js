import { generateUUID } from '../utils/uuid.js';

export const DEFAULT_STATUSES = ['Incubating', 'Exploring', 'Validating', 'Building', 'Shipped', 'Dropped'];

export const COLOR_VARIANTS = ['primary', 'secondary', 'tertiary'];

export const SUGGESTION_TYPES = ['improvement', 'connection', 'new_idea', 'merge'];

export function createIdea(data = {}) {
  const now = Date.now();
  return {
    id: data.id || generateUUID(),
    title: data.title || '',
    summary: data.summary || '',
    problem: data.problem || '',
    why_interesting: data.why_interesting || '',
    category: data.category || '',
    status: data.status || 'Incubating',
    confidence: data.confidence ?? 50,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    last_reviewed_at: data.last_reviewed_at || null,
    next_review_at: data.next_review_at || (now + 2 * 24 * 60 * 60 * 1000),
    review_cadence_days: data.review_cadence_days || 14,
    ignored_count: data.ignored_count || 0,
    links: data.links || [],
    merged_from: data.merged_from || [],
    is_archived: data.is_archived || false,
    canvas_pos: data.canvas_pos || { x: Math.random() * 800, y: Math.random() * 600 },
    color_variant: data.color_variant || COLOR_VARIANTS[Math.floor(Math.random() * COLOR_VARIANTS.length)],
    tags: data.tags || [],
    assumptions: data.assumptions || [],
    open_questions: data.open_questions || [],
    next_steps: data.next_steps || [],
    reviews: data.reviews || [],
    is_ai_suggestion: data.is_ai_suggestion || false,
    suggestion_type: data.suggestion_type || null,
    suggestion_reason: data.suggestion_reason || '',
    suggestion_target_id: data.suggestion_target_id || null
  };
}

export function createAssumption(data = {}) {
  return {
    id: data.id || generateUUID(),
    text: data.text || '',
    confidence: data.confidence || 'medium',
    last_checked_at: data.last_checked_at || null,
    status: data.status || 'active'
  };
}

export function createOpenQuestion(data = {}) {
  const now = Date.now();
  return {
    id: data.id || generateUUID(),
    text: data.text || '',
    status: data.status || 'open',
    notes: data.notes || '',
    created_at: data.created_at || now
  };
}

export function createNextStep(data = {}) {
  const now = Date.now();
  return {
    id: data.id || generateUUID(),
    text: data.text || '',
    status: data.status || 'todo',
    due_date: data.due_date || null,
    created_at: data.created_at || now
  };
}

export function createReview(data = {}) {
  const now = Date.now();
  return {
    id: data.id || generateUUID(),
    idea_id: data.idea_id || '',
    created_at: data.created_at || now,
    prompt_set_id: data.prompt_set_id || '',
    answers: data.answers || {},
    confidence_before: data.confidence_before ?? 50,
    confidence_after: data.confidence_after ?? 50,
    system_suggested_confidence: data.system_suggested_confidence ?? 50,
    user_adjusted: data.user_adjusted || false,
    mood: data.mood || null,
    notes: data.notes || ''
  };
}

export function isIdeaDue(idea) {
  return idea.next_review_at <= Date.now() && !idea.is_archived;
}

export function getStaleDays(idea) {
  if (!idea.last_reviewed_at) {
    return Math.floor((Date.now() - idea.created_at) / 86400000);
  }
  return Math.floor((Date.now() - idea.last_reviewed_at) / 86400000);
}

export function calculateNextReview(idea) {
  const baseTime = idea.last_reviewed_at || idea.created_at;
  return baseTime + (idea.review_cadence_days * 24 * 60 * 60 * 1000);
}
