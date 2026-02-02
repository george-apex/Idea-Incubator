export function calculateSuggestedConfidence(idea, reviewData) {
  const c0 = idea.confidence;
  let delta = 0;
  
  const answers = reviewData.answers || {};
  const hasNextStep = answers.next_step && answers.next_step.trim().length > 0;
  const invalidatedAssumption = idea.assumptions.some(a => a.status === 'invalidated');
  const previousStatus = idea.status;
  const newStatus = reviewData.new_status;
  const snoozeCount = reviewData.snooze_count || 0;
  const interestAnswer = answers.interest_delta || '';
  
  if (hasNextStep) {
    delta += 3;
  }
  
  if (invalidatedAssumption) {
    delta += -8;
  }
  
  if (newStatus && previousStatus !== newStatus) {
    const statusOrder = ['Incubating', 'Exploring', 'Validating', 'Building', 'Shipped', 'Dropped'];
    const prevIndex = statusOrder.indexOf(previousStatus);
    const newIndex = statusOrder.indexOf(newStatus);
    
    if (newIndex > prevIndex) {
      delta += 5;
    } else if (newIndex < prevIndex) {
      delta += -5;
    }
  }
  
  if (snoozeCount === 1) {
    delta += -2;
  } else if (snoozeCount >= 2) {
    delta += -4;
  }
  
  if (interestAnswer.includes('more interesting')) {
    delta += 4;
  } else if (interestAnswer.includes('less interesting')) {
    delta += -6;
  }
  
  const suggested = Math.max(0, Math.min(100, c0 + delta));
  
  return {
    suggested,
    delta,
    previous: c0
  };
}
