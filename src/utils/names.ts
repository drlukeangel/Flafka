// Memorable word-based name generator — used for statement names and cell labels

import { env } from '../config/environment';

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

// Employee ID — used as the session tag so resources can be traced back to their creator.
// Set VITE_EMPLOYEE_ID in your .env file. Defaults to 'f696969'.
const EMPLOYEE_ID: string = env.employeeId;

/** Get the current session tag (employee ID). Stable for the lifetime of this app load. */
export function getSessionTag(): string {
  return EMPLOYEE_ID;
}

/** Generate a fun name like "wobbling-penguin-f696969" — used for cell labels and statement names */
export function generateFunName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${EMPLOYEE_ID}`;
}

/** Generate a unique statement name like "wobbling-penguin-f696969" — same format, used for API calls */
export function generateStatementName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${EMPLOYEE_ID}`;
}

/** Generate a topic-prefixed statement name like "loan-details-355-wobbling-penguin" */
export function generateTopicStatementName(topicName: string): string {
  const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Confluent API requires statement names to start with a letter
  const safeSlug = /^[a-z]/.test(slug) ? slug : `s-${slug}`;
  return `${safeSlug}-${EMPLOYEE_ID}-${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}
