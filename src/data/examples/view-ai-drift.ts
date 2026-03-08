import type { KickstarterExampleDef } from '../../services/example-runner';

export const viewAiDriftDef: KickstarterExampleDef = {
  id: 'view-ai-drift',
  tables: [
    {
      name: 'AI-AUDIT-LOG',
      schema: 'ai-audit-log',
      role: 'input',
      dataset: { generator: 'ai-audit-log', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'AI-DRIFT-MONITOR',
      schema: 'view',
      role: 'output',
      type: 'view',
    },
  ],
  sql: [
    {
      label: 'create-drift-view',
      sql: `CREATE VIEW \`{AI-DRIFT-MONITOR}\` AS
SELECT
  audit_id,
  model_id,
  prediction,
  human_outcome,
  confidence,
  reviewed_at,
  CASE
    WHEN prediction <> human_outcome AND confidence >= 0.5 THEN 'DISCREPANCY'
    WHEN confidence < 0.5 THEN 'LOW_CONFIDENCE_REVIEW'
    ELSE 'ALIGNED'
  END AS audit_status
FROM \`{AI-AUDIT-LOG}\`

-- ============================================================
-- WHAT: Creates a virtual view that classifies each AI prediction.
-- WHY: Regulators require monitoring of AI model drift and bias.
--      This view flags cases where AI disagrees with human reviewers.
-- HOW: CASE WHEN compares prediction vs human_outcome.
--      DISCREPANCY = AI and human disagree (high confidence).
--      LOW_CONFIDENCE_REVIEW = model unsure (confidence < 0.5).
--      ALIGNED = AI and human agree.
-- VIRTUAL VIEW: No data is materialized — the view is a saved query
--               that runs on-demand when you SELECT from it.
-- ============================================================`,
    },
    {
      label: 'surface-drift',
      sql: `SELECT * FROM \`{AI-DRIFT-MONITOR}\`
WHERE audit_status IN ('DISCREPANCY', 'LOW_CONFIDENCE_REVIEW')
LIMIT 50

-- ============================================================
-- WHAT: Queries the virtual view to surface AI drift and bias.
-- WHY: These are the records that need human review — either the
--      model disagreed with the human, or confidence was too low.
-- ACTION: Route these to compliance team for investigation.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your AI drift monitoring workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce audit log data', detail: 'Click play on the AI-AUDIT-LOG stream card to send 200 audit records.' },
      { label: 'Create the virtual view', detail: 'Run the CREATE VIEW cell to register the drift monitoring view in the catalog.' },
      { label: 'Surface drift cases', detail: 'Run the SELECT query to find discrepancies and low-confidence predictions.' },
    ],
  },
};
