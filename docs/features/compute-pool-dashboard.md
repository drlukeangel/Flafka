# Compute Pool Dashboard

## Overview
Clickable header badge that opens a push-down panel showing running statements with real-time telemetry metrics from the Confluent Cloud Telemetry API.

## User Journey
1. User sees "PROVISIONED · 4/10 CFU" badge in header center
2. Clicks badge → panel pushes down between header and content
3. Table shows all running statements with CFU, Records In/Out, Pending, State Size
4. User can Stop a statement, Refresh data, or drag the bottom edge to resize
5. Click badge again, Escape, click-outside, or X to close
6. "View all jobs" link navigates to full Jobs page

## API
- Telemetry: POST `/v2/metrics/cloud/query` via `api.telemetry.confluent.cloud`
- 5 metrics: current_cfus, num_records_in, num_records_out, pending_records, operator/state_size_bytes
- Statement metadata: GET `/sql/v1/.../statements` (listStatements)
- Compute pool: GET `/v2/compute-pools/{id}` (includes spec.max_cfu)

## Accessibility
- Badge is `<button>` with `aria-expanded`, `aria-controls`
- Panel has `role="region"`, `aria-label`, matching `id`
- Focus moves into panel on open, returns to badge on close
- Escape closes panel
- Stop buttons have `aria-label="Stop statement {name}"`
- Semantic `<table>` with `scope="col"` headers
