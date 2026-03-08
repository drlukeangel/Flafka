import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanEventFanoutDef: KickstarterExampleDef = {
  id: 'loan-event-fanout',
  tables: [
    {
      name: 'LOAN-EVENTS',
      schema: 'loan-events',
      role: 'input',
      dataset: { generator: 'loan-events', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'EVENTS-UNDERWRITING',
      schema: 'routed-events',
      role: 'output',
    },
    {
      name: 'EVENTS-FINANCE',
      schema: 'routed-events',
      role: 'output',
    },
    {
      name: 'EVENTS-FORECLOSURES',
      schema: 'routed-events',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'route-underwriting',
      sql: `INSERT INTO \`{EVENTS-UNDERWRITING}\`
SELECT * FROM \`{LOAN-EVENTS}\`
WHERE event_type = 'NEW_LOAN'

-- ============================================================
-- WHAT: Routes NEW_LOAN events to the Underwriting department topic.
-- WHY: Underwriting only cares about new loan applications.
-- LIMITATION: Adding a new department or event type means new SQL + new deploy.
--             See the Advanced version (Dynamic Event Routing) for a data-driven approach.
-- ============================================================`,
    },
    {
      label: 'route-finance',
      sql: `INSERT INTO \`{EVENTS-FINANCE}\`
SELECT * FROM \`{LOAN-EVENTS}\`
WHERE event_type IN ('PAYMENT', 'FORECLOSURE')

-- ============================================================
-- WHAT: Routes PAYMENT and FORECLOSURE events to Finance.
-- ============================================================`,
    },
    {
      label: 'route-foreclosures',
      sql: `INSERT INTO \`{EVENTS-FORECLOSURES}\`
SELECT * FROM \`{LOAN-EVENTS}\`
WHERE event_type IN ('FORECLOSURE', 'TERMINATION')

-- ============================================================
-- WHAT: Routes FORECLOSURE and TERMINATION events to the Foreclosures team.
-- NOTE: FORECLOSURE appears in both Finance AND Foreclosures — intentional overlap.
-- ============================================================`,
    },
    {
      label: 'view-finance',
      sql: `SELECT * FROM \`{EVENTS-FINANCE}\` LIMIT 50

-- ============================================================
-- WHAT: Verifies that Finance receives only PAYMENT and FORECLOSURE events.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your static fan-out workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce event data', detail: 'Click the play button on LOAN-EVENTS to send 200 lifecycle events.' },
      { label: 'Run all 3 routing jobs', detail: 'Run each INSERT INTO cell to route events to department topics.' },
      { label: 'View Finance events', detail: 'Run the SELECT query to verify only PAYMENT and FORECLOSURE events arrived.' },
    ],
  },
};
