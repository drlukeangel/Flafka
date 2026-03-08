# Good Jokes

Filter a jokes stream — LOL, ROFL, and DEAD ratings flow to GOOD-JOKES. GROAN and MEH get dropped. This example shows how a simple WHERE clause in Flink SQL can act as a real-time filter on a streaming topic.

## Metadata

- **Group:** Basics
- **Tags:** Quick Start, Filter, Streaming

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

```sql
INSERT INTO `{rid}-GOOD-JOKES`
SELECT * FROM `{rid}-JOKES`
WHERE rating IN ('LOL', 'ROFL', 'DEAD')
```

## Example Input

```json
{"joke_id": "J-001", "joke": "A SQL query walks into a bar, walks up to two tables and asks... Can I join you?", "category": "tech", "rating": "ROFL"}
{"joke_id": "J-002", "joke": "Why did the scarecrow win an award? He was outstanding in his field.", "category": "dad", "rating": "GROAN"}
{"joke_id": "J-003", "joke": "Why don't scientists trust atoms? Because they make up everything.", "category": "science", "rating": "LOL"}
{"joke_id": "J-004", "joke": "I'm on a seafood diet. I see food and I eat it.", "category": "dad", "rating": "MEH"}
{"joke_id": "J-005", "joke": "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.", "category": "math", "rating": "DEAD"}
```

## Expected Output

Only jokes with ratings LOL, ROFL, or DEAD pass through. GROAN and MEH are dropped.

```json
{"joke_id": "J-001", "joke": "A SQL query walks into a bar, walks up to two tables and asks... Can I join you?", "category": "tech", "rating": "ROFL"}
{"joke_id": "J-003", "joke": "Why don't scientists trust atoms? Because they make up everything.", "category": "science", "rating": "LOL"}
{"joke_id": "J-005", "joke": "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.", "category": "math", "rating": "DEAD"}
```

J-002 (GROAN) and J-004 (MEH) are filtered out.

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Good Jokes** example from the Basics group.
3. Ensure the `JOKES` topic is populated (run the Hello Flink example first if needed).
4. Click **Run** to start the filter job.
5. Observe the `GOOD-JOKES` output topic — only jokes rated LOL, ROFL, or DEAD appear.
6. Verify that GROAN and MEH jokes are absent from the output.
