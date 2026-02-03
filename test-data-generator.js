import { v4 as uuidv4 } from 'uuid';

const topics = [
  {
    name: 'Product Strategy',
    subtopics: ['Market Analysis', 'Competitive Landscape', 'Value Proposition', 'Roadmap Planning', 'Feature Prioritization']
  },
  {
    name: 'Technical Architecture',
    subtopics: ['Backend Systems', 'Frontend Framework', 'Database Design', 'API Integration', 'Security Protocols']
  },
  {
    name: 'User Experience',
    subtopics: ['User Research', 'Interface Design', 'Accessibility', 'Performance Optimization', 'Mobile Responsiveness']
  },
  {
    name: 'Business Operations',
    subtopics: ['Team Structure', 'Budget Planning', 'Resource Allocation', 'Timeline Management', 'Risk Assessment']
  },
  {
    name: 'Marketing & Growth',
    subtopics: ['Brand Strategy', 'Content Marketing', 'Social Media', 'SEO Optimization', 'Customer Acquisition']
  }
];

const statuses = ['Exploring', 'Validating', 'Planning', 'In Progress', 'Review', 'Completed'];
const colorVariants = ['primary', 'secondary', 'tertiary'];

function generateIdea(title, parent = null, depth = 0) {
  const idea = {
    id: uuidv4(),
    title,
    summary: generateSummary(title),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    confidence: Math.floor(Math.random() * 40) + 60,
    color_variant: colorVariants[Math.floor(Math.random() * colorVariants.length)],
    canvas_pos: {
      x: Math.random() * 2000,
      y: Math.random() * 1500
    },
    links: [],
    parent_id: parent ? parent.id : null,
    assumptions: generateAssumptions(),
    questions: generateQuestions(),
    next_steps: generateNextSteps(),
    tags: generateTags(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    review_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_archived: false
  };

  if (parent) {
    parent.links.push(idea.id);
    idea.links.push(parent.id);
  }

  return idea;
}

function generateSummary(title) {
  const summaries = [
    `Key considerations for ${title.toLowerCase()} include multiple factors that need careful evaluation.`,
    `This ${title.toLowerCase()} initiative requires strategic planning and cross-functional collaboration.`,
    `Critical success factors for ${title.toLowerCase()} involve stakeholder alignment and resource optimization.`,
    `The ${title.toLowerCase()} approach should balance short-term wins with long-term sustainability.`,
    `Implementing ${title.toLowerCase()} effectively requires iterative testing and continuous feedback loops.`
  ];
  return summaries[Math.floor(Math.random() * summaries.length)];
}

function generateAssumptions() {
  const count = Math.floor(Math.random() * 4) + 2;
  const assumptions = [
    'Market demand will remain stable over the next 12 months',
    'Technical team capacity will increase by 20% in Q2',
    'User adoption rate will exceed 15% within first month',
    'Competitor response time will be at least 6 months',
    'Budget allocation will be approved by executive team',
    'Integration with existing systems will be straightforward',
    'Customer feedback will be positive and actionable',
    'Regulatory environment will remain favorable'
  ];
  return assumptions.slice(0, count);
}

function generateQuestions() {
  const count = Math.floor(Math.random() * 4) + 2;
  const questions = [
    'What are the primary success metrics for this initiative?',
    'How will we measure user engagement and satisfaction?',
    'What are the potential risks and mitigation strategies?',
    'Who are the key stakeholders and their priorities?',
    'What is the timeline for implementation and milestones?',
    'How does this align with broader company objectives?',
    'What resources are required and are they available?',
    'What are the alternative approaches and trade-offs?'
  ];
  return questions.slice(0, count);
}

function generateNextSteps() {
  const count = Math.floor(Math.random() * 4) + 2;
  const steps = [
    'Conduct stakeholder interviews and gather requirements',
    'Create detailed project plan with timeline and milestones',
    'Develop prototype for user testing and feedback',
    'Secure necessary budget and resource approvals',
    'Establish cross-functional team and define roles',
    'Set up analytics and tracking mechanisms',
    'Create communication plan for internal and external stakeholders',
    'Document technical specifications and architecture'
  ];
  return steps.slice(0, count);
}

function generateTags() {
  const allTags = [
    'strategy', 'planning', 'research', 'development', 'design',
    'marketing', 'sales', 'operations', 'finance', 'technology',
    'user-experience', 'analytics', 'growth', 'innovation', 'collaboration'
  ];
  const count = Math.floor(Math.random() * 4) + 2;
  const shuffled = allTags.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateTestData() {
  const ideas = [];
  const ideaMap = new Map();

  topics.forEach(topic => {
    const mainIdea = generateIdea(topic.name);
    ideas.push(mainIdea);
    ideaMap.set(topic.name, mainIdea);

    topic.subtopics.forEach(subtopic => {
      const subIdea = generateIdea(`${topic.name}: ${subtopic}`, mainIdea, 1);
      ideas.push(subIdea);
      ideaMap.set(`${topic.name}:${subtopic}`, subIdea);

      const detailCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < detailCount; i++) {
        const detailIdea = generateIdea(`${topic.name}: ${subtopic} - Detail ${i + 1}`, subIdea, 2);
        ideas.push(detailIdea);
      }
    });
  });

  ideas.forEach(idea => {
    const peerCount = Math.floor(Math.random() * 3);
    const potentialPeers = ideas.filter(other => 
      other.id !== idea.id && 
      other.parent_id !== idea.parent_id &&
      !idea.links.includes(other.id)
    );

    for (let i = 0; i < peerCount && potentialPeers.length > 0; i++) {
      const peerIndex = Math.floor(Math.random() * potentialPeers.length);
      const peer = potentialPeers.splice(peerIndex, 1)[0];
      idea.links.push(peer.id);
      peer.links.push(idea.id);
    }
  });

  return ideas;
}

const testData = generateTestData();
console.log(JSON.stringify(testData, null, 2));
