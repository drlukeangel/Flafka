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

// Short random hex to ensure uniqueness across calls
const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

// Unique ID — used as the session tag so resources can be traced back to their creator.
// Set VITE_UNIQUE_ID in your .env file. Confluent API requires lowercase alphanumeric + hyphens.
const UNIQUE_ID: string = env.uniqueId.toLowerCase().replace(/[^a-z0-9-]/g, '');

/**
 * Returns the sanitized unique ID that tags all resources created by this user session.
 * Derived from VITE_UNIQUE_ID in .env, lowercased and stripped to [a-z0-9-].
 * This tag is embedded in statement names and topic names so resources can be
 * traced back to their creator in multi-user Confluent Cloud environments.
 * Stable for the lifetime of this app load (does not change between calls).
 */
export function getSessionTag(): string {
  return UNIQUE_ID;
}

/** Generate a fun name like "wobbling-penguin-f696969" — used for cell labels and run IDs */
export function generateFunName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${UNIQUE_ID}`;
}

/**
 * Generates a unique Flink statement name for the Confluent Cloud API.
 * Format: "{adjective}-{noun}-{sessionTag}-{hex4}", e.g. "blazing-falcon-luke-a3f1".
 * The 4-char random hex suffix prevents collisions when multiple statements
 * are created in quick succession within the same session.
 */
export function generateStatementName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${UNIQUE_ID}-${hex4()}`;
}

/**
 * Generates a statement name prefixed with a slugified topic name.
 * Used for topic-specific operations (e.g. SELECT from a topic, describe topic schema)
 * so the statement can be visually associated with its target topic in the history panel.
 * Format: "{topic-slug}-{sessionTag}-{adjective}-{noun}-{hex4}"
 * The slug is sanitized to lowercase alphanumeric + hyphens; if it starts with a digit,
 * "s-" is prepended (Confluent API requires statement names to start with a letter).
 */
export function generateTopicStatementName(topicName: string): string {
  const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Confluent API requires statement names to start with a letter
  const safeSlug = /^[a-z]/.test(slug) ? slug : `s-${slug}`;
  return `${safeSlug}-${UNIQUE_ID}-${pick(ADJECTIVES)}-${pick(NOUNS)}-${hex4()}`;
}
