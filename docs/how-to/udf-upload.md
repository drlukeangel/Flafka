# How To: Upload and Register a UDF Artifact

This guide covers uploading a custom Java or Python UDF JAR/ZIP to Confluent Cloud via the Artifacts panel, then registering it as a Flink SQL function.

---

## Prerequisites

- `VITE_CLOUD_API_KEY` and `VITE_CLOUD_API_SECRET` configured in `.env`
- Your UDF compiled and packaged as a `.jar` (Java) or `.zip` (Python) file — max 256 MB
- For Java: entry class must be a fully-qualified class name, e.g. `com.example.MyScalarUdf`
- For Python: entry class must be a module path, e.g. `my_module.my_function`

---

## Step 1: Open the Artifacts Panel

Click the **package/box icon** in the left nav rail (or press the Artifacts nav item). The panel shows all artifacts currently visible for your session.

---

## Step 2: Click Upload

Click the **Upload** button in the top-right of the Artifacts panel header. The Upload Artifact modal opens.

---

## Step 3: Fill in the Form

| Field | Required | Notes |
|-------|----------|-------|
| **Content Format** | Yes | `JAR (Java)` for compiled Java UDFs, `ZIP (Python)` for Python UDFs |
| **Display Name** | Yes | A human-readable name. Your session tag (`-f696969`) is automatically appended, e.g. `My Scoring UDF-f696969` |
| **Entry Class** | Yes | Fully-qualified Java class name or Python module path |
| **Description** | No | Optional free-text description |
| **Documentation Link** | No | URL to external docs |
| **File** | Yes | The `.jar` or `.zip` file from your build output |

> **Tip:** The Display Name is how the artifact appears in your panel. Your session tag is appended automatically so the artifact is filtered to your session. You don't need to type the tag yourself.

---

## Step 4: Upload

Click **Upload**. Three steps run in sequence:

1. **Requesting upload URL** — Confluent Cloud returns a presigned S3 URL (indeterminate spinner, ~1s)
2. **Uploading file** — File bytes stream to S3 via a no-CORS form POST (progress bar shows %)
3. **Creating artifact** — Confluent Cloud registers the artifact and assigns an ID (indeterminate spinner, ~2-5s)

You can cancel at any time using the **Cancel** button, which aborts the upload mid-stream.

---

## Step 5: Get the CREATE FUNCTION Statement

After upload, the artifact appears in the list. Click it to open the detail panel.

The **SQL section** at the top shows a ready-to-use `CREATE FUNCTION` template:

```sql
CREATE FUNCTION <function_name>
  AS 'com.example.MyScalarUdf'
  USING JAR 'confluent-artifact://cfa-abc123/ver-1';
```

Click **Copy** to copy to clipboard, or **Insert at cursor** to paste directly into the focused editor cell.

Replace `<function_name>` with the SQL name you want to call the function (e.g. `MY_SCORING_UDF`).

---

## Step 6: Register the Function

Paste the `CREATE FUNCTION` statement into an editor cell and run it. Registration takes 30–90 seconds depending on language:

| Language | Typical Registration Time |
|----------|--------------------------|
| Java | 30–60 seconds |
| Python | 60–90 seconds |

Wait for the cell status to show **Completed** before calling the function in queries.

---

## Step 7: Use the Function in SQL

Once registered, call the function by name in any SQL cell:

```sql
-- Java scalar UDF example
SELECT loan_id, MY_SCORING_UDF(json_payload, 'underwriting.score') AS score
FROM `LOAN-APPLICATIONS`

-- Python scalar UDF example
SELECT loan_id, my_python_udf(json_payload) AS result
FROM `LOAN-APPLICATIONS`
```

---

## Managing Artifacts

### Finding your artifacts

The panel automatically filters to artifacts tagged with your session ID. Platform example artifacts (prefixed `platform-examples-`) are always visible regardless of session.

### Deleting an artifact

Click an artifact → scroll to the bottom of the detail panel → click **Delete Artifact** → type the exact display name to confirm.

> **Warning:** Deleting an artifact invalidates all `CREATE FUNCTION` statements that reference it. Those functions will fail at runtime until re-registered with a new artifact.

Platform example artifacts (showing the **Platform** badge) cannot be deleted — they are shared across all sessions.

### Multiple versions

If you upload a new version of the same artifact class, use the **version dropdown** in the SQL section to select which version the `CREATE FUNCTION` statement targets.

---

## Quick Start Examples

The **Learn → Examples** tab includes six UDF Quick Start examples that handle upload automatically:

| Example | UDF Type | What It Does |
|---------|----------|-------------|
| Loan Detail Extract | Java Scalar | Extracts fields from nested JSON |
| Loan Tradeline Explode (Java) | Java Table | Explodes JSON arrays into rows |
| Portfolio Stats | Java Aggregate | Weighted average credit scores |
| Dead-Letter Validation | Java Scalar | Routes valid/invalid loans |
| PII Masking | Java Scalar | Masks name, email, phone, SSN |
| Credit Bureau Enrichment | Java Scalar | Chain UDFs for pre-qualification |

Click **Set Up** on any of these cards to auto-upload the artifact, create tables, generate test data, and add workspace cells — ready to run.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Request failed with status code 400" on upload | Check that `VITE_CLOUD_API_KEY` and `VITE_CLOUD_API_SECRET` are set and valid |
| Artifact uploaded but not visible in list | Click the refresh icon; your session tag must match the artifact name's suffix |
| `CREATE FUNCTION` fails with "artifact not found" | The artifact may still be processing — wait 30 seconds and retry |
| Function call fails after registration | Ensure the cell that ran `CREATE FUNCTION` shows **Completed** status before using it |
| Python UDF registration takes > 2 minutes | This is normal — Python runtime initialization is slower than Java |
