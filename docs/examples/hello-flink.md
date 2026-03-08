# Hello Flink

Your first Flink job — streams 20 jokes into a topic and reads them back. No setup required. This example demonstrates the basics of inserting data into a Kafka-backed Flink table and querying it with a simple SELECT statement.

## Metadata

- **Group:** Basics
- **Tags:** Quick Start, Hello World, Streaming

## Input Schema

**Table: JOKES**

```sql
CREATE TABLE `{name}` (
  joke_id STRING NOT NULL,
  joke STRING,
  category STRING,
  rating STRING,
  PRIMARY KEY (joke_id) NOT ENFORCED
)
```

## Output Schema

**Table: GOOD-JOKES** (same schema as JOKES)

```sql
CREATE TABLE `{name}` (
  joke_id STRING NOT NULL,
  joke STRING,
  category STRING,
  rating STRING,
  PRIMARY KEY (joke_id) NOT ENFORCED
)
```

## SQL

### Cell 1 — Insert Jokes

```sql
INSERT INTO `{rid}-JOKES`
SELECT * FROM (VALUES
  ('J-001', 'A SQL query walks into a bar, walks up to two tables and asks... Can I join you?', 'tech', 'ROFL'),
  ('J-002', 'Why do Java developers wear glasses? Because they don''t C#.', 'tech', 'LOL'),
  ('J-003', 'Why don''t scientists trust atoms? Because they make up everything.', 'science', 'LOL'),
  ('J-004', 'I told my wife she was drawing her eyebrows too high. She looked surprised.', 'dad', 'GROAN'),
  ('J-005', 'Parallel lines have so much in common. It''s a shame they''ll never meet.', 'math', 'LOL'),
  ('J-006', 'What do you call a fake noodle? An impasta.', 'dad', 'MEH'),
  ('J-007', 'I''m reading a book about anti-gravity. It''s impossible to put down.', 'science', 'ROFL'),
  ('J-008', 'Why did the scarecrow win an award? He was outstanding in his field.', 'dad', 'GROAN'),
  ('J-009', 'There are only 10 types of people in the world: those who understand binary and those who don''t.', 'tech', 'ROFL'),
  ('J-010', 'I used to hate facial hair, but then it grew on me.', 'dad', 'MEH'),
  ('J-011', 'What''s the best thing about Switzerland? The flag is a big plus.', 'geography', 'LOL'),
  ('J-012', 'Did you hear about the mathematician who''s afraid of negative numbers? He''ll stop at nothing to avoid them.', 'math', 'DEAD'),
  ('J-013', 'Why do programmers prefer dark mode? Because light attracts bugs.', 'tech', 'ROFL'),
  ('J-014', 'I threw a boomerang a few years ago. I now live in constant fear.', 'dad', 'LOL'),
  ('J-015', 'What do you call a bear with no teeth? A gummy bear.', 'dad', 'MEH'),
  ('J-016', 'How does a penguin build its house? Igloos it together.', 'science', 'GROAN'),
  ('J-017', 'Why was the JavaScript developer sad? Because he didn''t Node how to Express himself.', 'tech', 'DEAD'),
  ('J-018', 'I''m on a seafood diet. I see food and I eat it.', 'dad', 'MEH'),
  ('J-019', 'What did the ocean say to the shore? Nothing, it just waved.', 'science', 'LOL'),
  ('J-020', 'Why did the developer go broke? Because he used up all his cache.', 'tech', 'ROFL')
) AS t(joke_id, joke, category, rating)
```

### Cell 2 — Read Jokes

```sql
SELECT * FROM `{rid}-JOKES` LIMIT 20
```

## Example Input

```json
{"joke_id": "J-001", "joke": "A SQL query walks into a bar, walks up to two tables and asks... Can I join you?", "category": "tech", "rating": "ROFL"}
{"joke_id": "J-002", "joke": "Why do Java developers wear glasses? Because they don't C#.", "category": "tech", "rating": "LOL"}
{"joke_id": "J-003", "joke": "Why don't scientists trust atoms? Because they make up everything.", "category": "science", "rating": "LOL"}
{"joke_id": "J-004", "joke": "I told my wife she was drawing her eyebrows too high. She looked surprised.", "category": "dad", "rating": "GROAN"}
{"joke_id": "J-005", "joke": "Parallel lines have so much in common. It's a shame they'll never meet.", "category": "math", "rating": "LOL"}
```

## Expected Output

The output is identical to the input — all 20 jokes are read back from the topic.

```json
{"joke_id": "J-001", "joke": "A SQL query walks into a bar, walks up to two tables and asks... Can I join you?", "category": "tech", "rating": "ROFL"}
{"joke_id": "J-002", "joke": "Why do Java developers wear glasses? Because they don't C#.", "category": "tech", "rating": "LOL"}
{"joke_id": "J-003", "joke": "Why don't scientists trust atoms? Because they make up everything.", "category": "science", "rating": "LOL"}
{"joke_id": "J-004", "joke": "I told my wife she was drawing her eyebrows too high. She looked surprised.", "category": "dad", "rating": "GROAN"}
{"joke_id": "J-005", "joke": "Parallel lines have so much in common. It's a shame they'll never meet.", "category": "math", "rating": "LOL"}
```

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Hello Flink** example from the Basics group.
3. Click **Run** to execute Cell 1, which inserts all 20 jokes into the `JOKES` topic.
4. Wait for the insert job to complete successfully.
5. Execute Cell 2 to read the jokes back from the topic.
6. Verify that all 20 joke records appear in the results.
