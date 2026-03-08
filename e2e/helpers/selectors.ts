export const SEL = {
  // Navigation
  NAV_LEARN: 'button[aria-label="Learn"]',
  NAV_WORKSPACE: 'button[aria-label="SQL Workspace"]',
  LEARN_PANEL: '[aria-label="Learn panel"]',

  // Example cards
  JAVA_CARD: '[data-testid="example-card-loan-scalar-extract"]',
  PYTHON_CARD: '[data-testid="example-card-loan-table-explode"]',

  // All example card selectors
  card: (id: string) => `[data-testid="example-card-${id}"]`,

  // Toast notifications
  TOAST_SUCCESS: '.toast-success',
  TOAST_ERROR: '.toast-error',
  TOAST_MESSAGE: '.toast-message',

  // Setup progress
  progress: (id: string) => `[data-testid="setup-progress-${id}"]`,

  // Cell status badges
  CELL_STATUS_COMPLETED: '.cell-status--completed, [data-status="COMPLETED"]',
  CELL_STATUS_RUNNING: '.cell-status--running, [data-status="RUNNING"]',

  // Results table
  RESULTS_ROW: '.results-table tbody tr, .result-row, [data-testid="result-row"]',

  // Close button on detail page
  DETAIL_CLOSE: 'button[aria-label="Close detail page"]',

  // Notes panel
  NOTES_PANEL: '.tab-bar__notes-panel',
  NOTES_TEXTAREA: '.tab-bar__notes-textarea',
};
