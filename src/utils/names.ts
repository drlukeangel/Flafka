// Memorable word-based name generator — used for statement names and cell labels

const ADJECTIVES = [
  'wobbling', 'dizzy', 'bouncy', 'sneaky', 'cosmic', 'fizzy', 'grumpy', 'jolly',
  'zippy', 'wiggly', 'fluffy', 'chunky', 'spicy', 'crispy', 'snappy', 'blazing',
  'drifting', 'glowing', 'howling', 'jumping', 'lurking', 'mighty', 'nimble', 'prancing',
  'roaming', 'sizzling', 'turbo', 'vivid', 'whirling', 'zappy', 'dancing', 'flying',
  'giggling', 'humming', 'icy', 'mellow', 'peppy', 'rumbling', 'silent', 'twirling',
  'buzzing', 'dashing', 'frosty', 'golden', 'hasty', 'laser', 'mystic', 'nifty',
  'plucky', 'rapid', 'swift', 'warp', 'atomic', 'bubbly', 'clever', 'dozing',
  'eager', 'fancy', 'gusty', 'hyper', 'jaunty', 'keen', 'lively', 'noble',
];

const NOUNS = [
  'penguin', 'narwhal', 'walrus', 'badger', 'falcon', 'otter', 'panda', 'gecko',
  'yak', 'bison', 'cobra', 'dingo', 'eagle', 'ferret', 'gopher', 'heron',
  'iguana', 'jackal', 'koala', 'lemur', 'marmot', 'newt', 'osprey', 'parrot',
  'quail', 'raven', 'stork', 'toucan', 'urchin', 'viper', 'wombat', 'zebra',
  'alpaca', 'bobcat', 'condor', 'donkey', 'ermine', 'finch', 'grouse', 'hippo',
  'impala', 'jaguar', 'kiwi', 'llama', 'moose', 'nutria', 'okapi', 'puffin',
  'quokka', 'raptor', 'sloth', 'tapir', 'unicorn', 'vulture', 'weasel', 'yeti',
  'mantis', 'coyote', 'crane', 'dragon', 'emu', 'fox', 'gibbon', 'hamster',
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Session number — generated once per app load, shared across ALL names in this session.
// Search this number in the Jobs page to find all statements from this session.
const SESSION_NUMBER = Math.floor(Math.random() * 900) + 100; // 100–999

/** Get the current session number. Stable for the lifetime of this app load. */
export function getSessionTag(): string {
  return String(SESSION_NUMBER);
}

/** Generate a fun name like "wobbling-penguin-4827" — used for cell labels and statement names */
export function generateFunName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${SESSION_NUMBER}`;
}

/** Generate a unique statement name like "wobbling-penguin-4827" — same format, used for API calls */
export function generateStatementName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${SESSION_NUMBER}`;
}
