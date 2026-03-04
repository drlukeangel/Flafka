/**
 * @example-runner
 * Generic template engine for Quick Start example cards.
 *
 * New examples are defined as typed KickstarterExampleDef config objects.
 * This runner handles all infrastructure boilerplate: table creation,
 * dataset generation, stream card registration, and SQL cell injection.
 *
 * To add a new example: write a config file + register the card. No new
 * runner code required for standard examples.
 */

import { createTable, type BaseExampleStoreSlice } from './example-helpers';
import { generateFunName } from '../utils/names';
import type { ExampleCompletionModal } from '../types';

// ---------------------------------------------------------------------------
// Table schema registry
// ---------------------------------------------------------------------------

type DDLFactory = (tableName: string) => string;

const TABLE_SCHEMAS: Record<string, DDLFactory | string> = {
  'loans-standard': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  txn_id STRING,
  customer_id STRING
)`,
  // alias — identical DDL to loans-standard
  'loans-filtered': 'loans-standard',
  'loans-stats': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  window_start STRING,
  window_end STRING,
  status STRING,
  loan_count BIGINT,
  total_amount DOUBLE
)`,
  'customers-risk': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING,
  name STRING,
  risk_score INT,
  risk_level STRING
)`,
  'customers-credit': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING NOT NULL,
  name STRING,
  credit_score INT,
  state STRING,
  valid_from STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  // Streaming join is append-only — no changelog.mode or PRIMARY KEY needed
  'fraud-alerts': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  customer_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_name STRING,
  risk_score INT,
  risk_level STRING,
  alert_reason STRING
)`,
  'loans-enriched': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  customer_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_name STRING,
  credit_score INT,
  state STRING
)`,
  // Jokes — no key field (beginner-friendly)
  'jokes': (n) => `CREATE TABLE \`${n}\` (
  joke_id STRING,
  joke STRING,
  category STRING,
  rating STRING
)`,
  'good-jokes': 'jokes',
};

function resolveDDL(key: string, tableName: string): string {
  const entry = TABLE_SCHEMAS[key];
  if (!entry) throw new Error(`Unknown schema: ${key}`);
  if (typeof entry === 'string') return resolveDDL(entry, tableName); // follow alias
  return entry(tableName);
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack'];
const LAST_NAMES = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davis', 'Wilson', 'Moore', 'Anderson', 'Martin'];
const US_STATES = ['CA', 'NY', 'TX', 'FL', 'WA', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'AZ', 'CO'];

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateFlatLoans(count: number): Record<string, unknown>[] {
  const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    loan_id: `LN-2024-${String(i + 1).padStart(5, '0')}`,
    amount: (Math.floor(Math.random() * 141) + 10) * 500, // 5000–75000, multiples of 500
    status: statuses[i % 4],
    created_at: new Date(now - (count - i) * 5 * 60 * 1000).toISOString(),
    txn_id: `TXN-${String(i + 1).padStart(4, '0')}`,
    customer_id: `C-${String((i % 10) + 1).padStart(3, '0')}`,
    // No `key` field — BYTES column is populated by Kafka message key header, not value payload
  }));
}

function riskLevel(score: number): string {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

export function generateCustomerRiskProfiles(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => {
    const score = Math.floor(Math.random() * 99) + 1; // 1–99
    return {
      customer_id: `C-${String(i + 1).padStart(3, '0')}`,
      name: `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`,
      risk_score: score,
      risk_level: riskLevel(score),
    };
  });
}

export function generateCustomerCreditProfiles(count: number): Record<string, unknown>[] {
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const customerId = `C-${String(i + 1).padStart(3, '0')}`;
    const name = `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`;
    const state = pickFrom(US_STATES);
    const baseScore = Math.floor(Math.random() * 241) + 580; // 580–820
    const shift = (Math.floor(Math.random() * 16) + 15) * (Math.random() < 0.5 ? 1 : -1); // ±15–30
    const secondScore = Math.min(850, Math.max(300, baseScore + shift));
    const t1 = new Date(now - (count - i + 1) * 5 * 60 * 1000).toISOString();
    const t2 = new Date(now - (count - i) * 5 * 60 * 1000).toISOString();
    rows.push({
      customer_id: customerId,
      name,
      credit_score: baseScore,
      state,
      valid_from: t1,
    });
    rows.push({
      customer_id: customerId,
      name,
      credit_score: secondScore,
      state,
      valid_from: t2,
    });
  }
  return rows;
}

export function generateJokes(count: number): Record<string, unknown>[] {
  const JOKES: { joke: string; category: string; rating: string }[] = [
    // Tech
    { joke: "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'", category: 'tech', rating: 'ROFL' },
    { joke: "Why do Java developers wear glasses? Because they don't C#.", category: 'tech', rating: 'LOL' },
    { joke: "There are 10 types of people: those who understand binary and those who don't.", category: 'tech', rating: 'LOL' },
    { joke: "How do you comfort a JavaScript bug? You console it.", category: 'tech', rating: 'LOL' },
    { joke: "Why was the function depressed? It had too many arguments and nobody called.", category: 'tech', rating: 'DEAD' },
    { joke: "I told my computer I needed a break. Now it won't stop sending me Kit Kat ads.", category: 'tech', rating: 'ROFL' },
    { joke: "A TCP packet walks into a bar. 'I'd like a beer.' Bartender: 'You want a beer?' Packet: 'Yes, a beer.'", category: 'tech', rating: 'DEAD' },
    { joke: "Why do programmers prefer dark mode? Because light attracts bugs.", category: 'tech', rating: 'ROFL' },
    { joke: "I tried to write a joke about Kafka but it was too much of a stream of consciousness.", category: 'tech', rating: 'DEAD' },
    { joke: "Why did the developer quit? They didn't get arrays.", category: 'tech', rating: 'LOL' },
    { joke: "My code has no bugs. It has undocumented features.", category: 'tech', rating: 'LOL' },
    { joke: "I have a joke about UDP. You might not get it.", category: 'tech', rating: 'DEAD' },
    { joke: "Debugging is like being the detective in a crime movie where you're also the murderer.", category: 'tech', rating: 'DEAD' },
    { joke: "The best thing about a Boolean is that even if you're wrong, you're only off by a bit.", category: 'tech', rating: 'LOL' },
    { joke: "I asked a database admin what their favorite band is. They said 'DROP TABLE'.", category: 'tech', rating: 'DEAD' },
    { joke: "How many software engineers does it take to change a light bulb? None, that's a hardware problem.", category: 'tech', rating: 'LOL' },
    { joke: "A developer walks into a bar and finds a bug. Now there are 0 bars.", category: 'tech', rating: 'DEAD' },
    { joke: "An SQL query walks into a bar and orders everything in alphabetical ORDER BY.", category: 'tech', rating: 'LOL' },
    { joke: "Why do programmers mix up Halloween and Christmas? Because Oct 31 = Dec 25.", category: 'tech', rating: 'DEAD' },
    { joke: "My wifi password is 'incorrect'. When someone asks what it is, I say 'incorrect' and I'm not lying.", category: 'tech', rating: 'DEAD' },
    // Science
    { joke: "Why don't scientists trust atoms? Because they make up everything.", category: 'science', rating: 'LOL' },
    { joke: "I'd tell you a chemistry joke but I know I wouldn't get a reaction.", category: 'science', rating: 'LOL' },
    { joke: "Did you hear oxygen and potassium went on a date? It was OK.", category: 'science', rating: 'LOL' },
    { joke: "A neutron walks into a bar. 'How much for a beer?' Bartender: 'For you, no charge.'", category: 'science', rating: 'ROFL' },
    { joke: "Schrodinger's cat walks into a bar. And doesn't.", category: 'science', rating: 'DEAD' },
    { joke: "I have a joke about infinity. I never finish it.", category: 'science', rating: 'LOL' },
    { joke: "Why did the photon refuse to check its luggage? It was traveling light.", category: 'science', rating: 'LOL' },
    { joke: "Two blood cells met and fell in love. Sadly it was all in vein.", category: 'science', rating: 'GROAN' },
    { joke: "The mitochondria is the powerhouse of the cell. I've said it. I'll say it again. I'll never stop.", category: 'science', rating: 'ROFL' },
    { joke: "I used to be a banker but I lost interest.", category: 'science', rating: 'DEAD' },
    { joke: "An electron and a proton started a business. Unfortunately they had opposing charges.", category: 'science', rating: 'LOL' },
    { joke: "Why did the physics teacher break up with the biology teacher? There was no chemistry.", category: 'science', rating: 'ROFL' },
    { joke: "I stayed up all night wondering where the sun went. Then it dawned on me.", category: 'science', rating: 'DEAD' },
    { joke: "Why does a Moon-rock taste better than an Earth-rock? It's a little meteor.", category: 'science', rating: 'DEAD' },
    // Wordplay
    { joke: "I have a joke about paper. It's tearable.", category: 'wordplay', rating: 'DEAD' },
    { joke: "Time flies like an arrow. Fruit flies like a banana.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I don't trust stairs. They're always up to something.", category: 'wordplay', rating: 'LOL' },
    { joke: "I named my dog Stay. Now I say: 'Come here, Stay! Come here, Stay!'", category: 'wordplay', rating: 'DEAD' },
    { joke: "I'm writing a book on reverse psychology. Please don't buy it.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I used to hate facial hair. Then it grew on me.", category: 'wordplay', rating: 'LOL' },
    { joke: "I told someone to embrace their mistakes. They gave me a hug.", category: 'wordplay', rating: 'LOL' },
    { joke: "I'm reading a book about anti-gravity. Impossible to put down.", category: 'wordplay', rating: 'ROFL' },
    { joke: "I once got hit in the head with a can of soda. Luckily it was a soft drink.", category: 'wordplay', rating: 'LOL' },
    { joke: "I have a lot of jokes about retired people. None of them work.", category: 'wordplay', rating: 'DEAD' },
    { joke: "The rotation of the Earth really makes my day.", category: 'wordplay', rating: 'LOL' },
    { joke: "I used to be addicted to soap. I'm clean now.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I used to be indecisive. Now I'm not so sure.", category: 'wordplay', rating: 'DEAD' },
    { joke: "The early bird catches the worm. The second mouse gets the cheese. Timing is everything.", category: 'wordplay', rating: 'LOL' },
    { joke: "What do you call a factory that makes OK products? A satisfactory.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I'm on a seafood diet. I see food and I eat it.", category: 'wordplay', rating: 'GROAN' },
    { joke: "What do you call cheese that isn't yours? Nacho cheese.", category: 'wordplay', rating: 'GROAN' },
    { joke: "I have a joke about pizza. Never mind, it's too cheesy.", category: 'wordplay', rating: 'GROAN' },
    { joke: "I tried to write a joke about clocks. It was too time-consuming.", category: 'wordplay', rating: 'MEH' },
    { joke: "I have a joke about construction. Still working on it.", category: 'wordplay', rating: 'MEH' },
    // Dad jokes
    { joke: "What do you call a fake noodle? An impasta.", category: 'dad', rating: 'GROAN' },
    { joke: "Why did the bicycle fall over? It was two-tired.", category: 'dad', rating: 'MEH' },
    { joke: "Did you hear about the claustrophobic astronaut? They needed a little space.", category: 'dad', rating: 'LOL' },
    { joke: "What do you call a fish without eyes? A fsh.", category: 'dad', rating: 'DEAD' },
    { joke: "Why don't eggs tell jokes? They'd crack each other up.", category: 'dad', rating: 'LOL' },
    { joke: "What do you call a sleeping dinosaur? A dino-snore.", category: 'dad', rating: 'GROAN' },
    { joke: "Why did the scarecrow win an award? Outstanding in their field.", category: 'dad', rating: 'LOL' },
    { joke: "Why did the math book look so sad? Too many problems.", category: 'dad', rating: 'GROAN' },
    { joke: "Apparently you can't use 'beefstew' as a password. It's not stroganoff.", category: 'dad', rating: 'DEAD' },
    { joke: "I'm on a whiskey diet. I've lost three days already.", category: 'dad', rating: 'LOL' },
    { joke: "Why can't a leopard hide? Always spotted.", category: 'dad', rating: 'GROAN' },
    { joke: "What's brown and sticky? A stick.", category: 'dad', rating: 'GROAN' },
    { joke: "I bought some shoes from a drug dealer. Don't know what they laced them with but I was tripping all day.", category: 'dad', rating: 'DEAD' },
    { joke: "I have a joke about a broken pencil. Never mind, it's pointless.", category: 'dad', rating: 'DEAD' },
    { joke: "What do you call a bear with no teeth? A gummy bear.", category: 'dad', rating: 'GROAN' },
    // Spicy-safe
    { joke: "They say money can't buy happiness. But it can buy coffee, which is basically the same thing.", category: 'spicy', rating: 'LOL' },
    { joke: "I was addicted to the hokey pokey. I turned myself around.", category: 'spicy', rating: 'DEAD' },
    { joke: "My therapist told me I have trouble letting go of the past. I said: 'We'll see about that.'", category: 'spicy', rating: 'DEAD' },
    { joke: "I don't need a hair stylist. My pillow gives me a new hairstyle every morning.", category: 'spicy', rating: 'LOL' },
    { joke: "I was going to start a diet. Then the fridge light came on and it felt like a sign.", category: 'spicy', rating: 'LOL' },
    { joke: "I asked Siri why I'm still single. It opened the front-facing camera.", category: 'spicy', rating: 'DEAD' },
    { joke: "My patience is like a phone battery — works great right until it doesn't.", category: 'spicy', rating: 'LOL' },
    { joke: "I started a business selling trampolines. It has its ups and downs.", category: 'spicy', rating: 'DEAD' },
    { joke: "Someone stole my mood ring. I don't know how I feel about that.", category: 'spicy', rating: 'DEAD' },
    { joke: "Parallel lines have so much in common. It's a shame they'll never meet.", category: 'spicy', rating: 'LOL' },
  ];
  return Array.from({ length: count }, (_, i) => ({
    joke_id: `J-${String(i + 1).padStart(3, '0')}`,
    ...JOKES[i % JOKES.length],
  }));
}

const DATA_GENERATORS: Record<string, (count: number) => Record<string, unknown>[]> = {
  'flat-loans': generateFlatLoans,
  'customers-risk': generateCustomerRiskProfiles,
  'customers-credit': generateCustomerCreditProfiles,
  'flat-jokes': generateJokes,
};

// ---------------------------------------------------------------------------
// KickstarterExampleDef — typed config interface
// ---------------------------------------------------------------------------

export interface TableDef {
  name: string;              // base name: "LOANS"
  schema: string;            // key in TABLE_SCHEMAS registry
  role: 'input' | 'output';
  dataset?: { generator: string; count: number };
  stream?: 'produce-consume' | 'consume';
}

export interface CellDef {
  label: string;
  sql: string; // uses {TABLE_NAME} placeholders — already backtick-wrapped in template
}

export interface KickstarterExampleDef {
  id: string;
  tables: TableDef[];
  sql: CellDef[];
  completionModal?: Omit<ExampleCompletionModal, 'title'>;
}

// ---------------------------------------------------------------------------
// runKickstarterExample — generic runner
// ---------------------------------------------------------------------------

export async function runKickstarterExample(
  def: KickstarterExampleDef,
  store: BaseExampleStoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateFunName();

  // Resolve table names: "LOANS" → "LOANS-{rid}"
  const names: Record<string, string> = {};
  for (const t of def.tables) {
    names[t.name] = `${t.name}-${rid}`;
  }

  // Create all tables
  for (const t of def.tables) {
    await createTable(names[t.name], resolveDDL(t.schema, names[t.name]), onProgress);
  }

  // Generate datasets, register, add stream cards
  store.setStreamsPanelOpen(true);
  for (const t of def.tables) {
    if (!t.dataset) continue;
    const genFn = DATA_GENERATORS[t.dataset.generator];
    if (!genFn) throw new Error(`Unknown generator: ${t.dataset.generator}`);
    const records = genFn(t.dataset.count);
    const datasetId = crypto.randomUUID();
    const now = new Date().toISOString();
    store.addSchemaDataset({
      id: datasetId,
      name: `${t.name}-${rid}`,
      schemaSubject: `${names[t.name]}-value`,
      records,
      createdAt: now,
      updatedAt: now,
    });
    if (t.stream) {
      store.addStreamCard(names[t.name], t.stream, datasetId, {
        type: def.id,
        count: t.dataset.count,
      });
    }
  }

  // Add SQL cells — template substitution
  onProgress('Adding queries to workspace...');
  for (const cell of def.sql) {
    let sql = cell.sql;
    for (const [base, resolved] of Object.entries(names)) {
      // Replace {BASE_NAME} with resolved name (templates already include backticks)
      sql = sql.split(`{${base}}`).join(resolved);
    }
    store.addStatement(sql, undefined, `${cell.label}-${rid}`);
  }

  return { runId: rid };
}
