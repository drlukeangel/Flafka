export const SEL = {
  NAV_EXAMPLES: 'button[aria-label="Examples"]',
  NAV_WORKSPACE: 'button[aria-label="SQL Workspace"]',
  EXAMPLES_PANEL: '[aria-label="Examples panel"]',
  JAVA_CARD: '[data-testid="example-card-loan-scalar-extract"]',
  PYTHON_CARD: '[data-testid="example-card-loan-table-explode"]',
  TOAST_SUCCESS: '.toast-success',
  TOAST_ERROR: '.toast-error',
  TOAST_MESSAGE: '.toast-message',
  progress: (id: string) => `[data-testid="setup-progress-${id}"]`,
};
