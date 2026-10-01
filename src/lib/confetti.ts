import confetti from 'canvas-confetti';

interface EmojiCategory {
  keywords: string[];
  emoji: string[];
}

const CATEGORIES: EmojiCategory[] = [
  { keywords: ['sleep', 'nap', 'rest', 'bed', 'tired', 'snooze', 'siesta'], emoji: ['😴', '🛌', '💤'] },
  {
    keywords: [
      'food', 'eat', 'lunch', 'dinner', 'breakfast', 'snack', 'pizza', 'sushi',
      'ribs', 'donut', 'doughnut', 'pancake', 'pancakes', 'meal', 'cook', 'recipe', 'catering',
    ],
    emoji: ['🍣', '🍖', '🍩', '🥞', '🍕'],
  },
  { keywords: ['coffee', 'tea', 'espresso', 'latte'], emoji: ['☕'] },
  {
    keywords: [
      'bug', 'bugs', 'fix', 'debug', 'error', 'crash', 'hotfix', 'regression',
      'flaky', 'refactor', 'memory leak', 'merge conflict',
    ],
    emoji: ['🐛', '🔧', '🛠️'],
  },
  { keywords: ['test', 'tests', 'testing', 'qa', 'coverage', 'verify', 'reproduce'], emoji: ['✅', '🧪'] },
  { keywords: ['review', 'pr', 'pull request', 'approve', 'code review'], emoji: ['👀', '🔍'] },
  {
    keywords: ['deploy', 'ship', 'launch', 'release', 'rollout', 'go live', 'roll back', 'rollback', 'production'],
    emoji: ['🚀', '🎉'],
  },
  {
    keywords: [
      'server', 'servers', 'infra', 'infrastructure', 'ci', 'pipeline', 'docker',
      'kubernetes', 'cluster', 'staging', 'scale', 'monitor', 'backup', 'backups',
      'ssl', 'certificate', 'ssh', 'rotate', 'database', 'query', 'dependencies', 'migrate',
    ],
    emoji: ['⚙️', '🖥️'],
  },
  { keywords: ['design', 'redesign', 'ui', 'ux', 'mockup', 'figma', 'prototype', 'wireframe', 'wireframes', 'usability', 'brand', 'palette', 'icon', 'animation'], emoji: ['🎨', '🖌️'] },
  { keywords: ['roadmap', 'backlog', 'sprint', 'prioritize', 'prd', 'spec', 'mvp', 'scope', 'changelog', 'retro'], emoji: ['🗺️', '📌'] },
  {
    keywords: [
      'meeting', 'meetings', 'call', 'calls', 'standup', 'sync', 'kickoff',
      '1:1', 'one-on-one', 'agenda', 'all-hands', 'huddle', 'conference room', 'conference call',
    ],
    emoji: ['📞', '🗓️'],
  },
  { keywords: ['email', 'inbox', 'message', 'reply'], emoji: ['📧', '✉️'] },
  { keywords: ['write', 'writing', 'doc', 'docs', 'blog', 'report', 'article', 'documentation', 'whitepaper', 'notes'], emoji: ['✍️', '📝'] },
  { keywords: ['read', 'reading', 'book', 'research', 'competitor', 'analysis'], emoji: ['📚', '📖'] },
  { keywords: ['marketing', 'newsletter', 'social media', 'campaign', 'seo', 'landing page', 'copy'], emoji: ['📣', '📢'] },
  { keywords: ['sales', 'lead', 'leads', 'customer', 'client', 'ticket', 'tickets', 'deal', 'demo', 'onboard'], emoji: ['🤝', '💰'] },
  {
    keywords: [
      'hire', 'hiring', 'candidate', 'interview', 'resume', 'resumes', 'onboarding',
      'performance review', 'performance reviews', 'employee', 'handbook',
    ],
    emoji: ['🧑‍💼', '📋'],
  },
  { keywords: ['expense', 'expenses', 'budget', 'tax', 'taxes', 'contract', 'legal', 'reconcile', 'license', 'invoice', 'invoices'], emoji: ['💰', '📄'] },
  { keywords: ['data', 'metrics', 'dashboard', 'analytics', 'churn'], emoji: ['📊', '📈'] },
  { keywords: ['security', 'vulnerability', 'patch', 'audit', 'permissions', 'encrypt'], emoji: ['🔒', '🛡️'] },
  { keywords: ['workout', 'gym', 'run', 'exercise', 'fitness', 'meditate', 'doctor', 'appointment'], emoji: ['🏋️', '🏃', '💪'] },
  { keywords: ['travel', 'flight', 'flights', 'trip', 'vacation', 'hotel', 'offsite'], emoji: ['✈️', '🧳'] },
  { keywords: ['shop', 'shopping', 'buy', 'groceries', 'supplies', 'dry cleaning', 'charger', 'chargers'], emoji: ['🛍️', '🛒'] },
  { keywords: ['clean', 'cleaning', 'tidy', 'laundry', 'desk', 'organize', 'plants'], emoji: ['🧹', '🧺'] },
  { keywords: ['cat', 'kitten', 'pet', 'dog', 'feed'], emoji: ['😽', '🐱'] },
  { keywords: ['party', 'celebrate', 'celebration', 'milestone', 'holiday'], emoji: ['🎊', '🥳'] },
  { keywords: ['drive', 'driving', 'car', 'race', 'commute'], emoji: ['🏎️', '🚗'] },
  { keywords: ['love', 'heart', 'date', 'anniversary'], emoji: ['💖', '😍'] },
  { keywords: ['dizzy', 'overwhelm', 'confus', 'stuck', 'blocked'], emoji: ['😵'] },
  { keywords: ['silly', 'fun', 'joke', 'prank'], emoji: ['😛', '🤪'] },
  { keywords: ['space', 'rocket', 'astronaut'], emoji: ['🐱‍🚀', '🚀'] },
];

const FALLBACK_EMOJI = ['🎉', '🥳', '✅', '👍', '⭐', '😀'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word matching (not substring) so e.g. "Beat the deadline" doesn't
// false-positive on "eat", and "cartography" doesn't match "car".
const COMPILED_CATEGORIES = CATEGORIES.map((category) => ({
  pattern: new RegExp(`\\b(?:${category.keywords.map(escapeRegExp).join('|')})\\b`, 'i'),
  emoji: category.emoji,
}));

function pickEmojiForTitle(title: string): string {
  const matchingEmoji = COMPILED_CATEGORIES.filter((category) =>
    category.pattern.test(title),
  ).flatMap((category) => category.emoji);

  const pool = matchingEmoji.length > 0 ? matchingEmoji : FALLBACK_EMOJI;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function burstConfetti(x: number, y: number, title: string, reduceMotion = false): void {
  const origin = { x: x / window.innerWidth, y: y / window.innerHeight };
  const emoji = pickEmojiForTitle(title);
  const shape = confetti.shapeFromText({ text: emoji, scalar: 3 });

  if (reduceMotion) {
    // One small, calm burst: no spinning or wobble, short-lived, fewer pieces.
    confetti({
      origin,
      spread: 70,
      angle: 90,
      startVelocity: 18,
      particleCount: 18,
      ticks: 45,
      gravity: 1,
      scalar: 3,
      flat: true,
      shapes: [shape],
      zIndex: 9999,
    });
    return;
  }

  const shared = {
    origin,
    spread: 360,
    ticks: 70,
    gravity: 0.7,
    scalar: 4,
    shapes: [shape],
    zIndex: 9999,
  };

  // Fire several overlapping bursts in the same instant so the explosion
  // reads as one big eruption of confetti, not a trickle.
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      confetti({
        ...shared,
        particleCount: 90,
        startVelocity: 25 + i * 3,
      });
    }, i * 40);
  }
}
