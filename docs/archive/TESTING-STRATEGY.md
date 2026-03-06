# Tiered Testing Strategy: Balancing Speed & Quality

## Overview

This strategy splits test coverage into **Tier 1 (Blocking)** and **Tier 2 (Async)** to enable fast feature shipping while maintaining code quality and correctness.

**Key Principle:** Ship features with high-confidence validation (Tier 1 tests + UX approval), complete edge cases asynchronously (Tier 2 tests).

---

## Test Tier Definitions

### Tier 1: Critical Path Tests (BLOCKING)
- **Purpose:** Validate that the feature works for its primary use cases
- **Scope:** Happy path + critical error scenarios
- **Examples:**
  - User creates a ticket (happy path)
  - User tries to create ticket with missing required fields (validation error)
  - API returns 400 for invalid input
  - Happy path responses have correct JSON schema
- **Coverage Target:** 40-50% of feature code
- **Pass Rate Requirement:** 100% (MUST pass before shipping)
- **Timeline:** Completed in Phase B (before acceptance)

### Tier 2: Edge Cases & Robustness (NON-BLOCKING)
- **Purpose:** Handle edge cases, error paths, performance scenarios
- **Scope:** Edge cases, boundary conditions, rare errors, concurrency
- **Examples:**
  - User tries to create ticket with 10,000 character description
  - Simultaneous requests from 100 users
  - Database timeout scenario
  - Network retry logic
  - Unicode/special character handling
- **Coverage Target:** Remaining ~30-40% of feature code
- **Pass Rate Requirement:** 100% (but completed after shipping)
- **Timeline:** Completed in Track C (post-acceptance, async)

### Non-Testable Items (Doc-Only)
- **Purpose:** Features that can't be automated but still need validation
- **Scope:** Temporal behavior, third-party integrations, manual workflows
- **Examples:**
  - "Feature sends email notification (3 seconds after ticket creation)"
  - "Feature integrates with Slack API" → Document integration setup, manual test steps
- **Validation:** Test plan in PRD documents manual test steps
- **Owner:** QA Manager reviews + documents in test report

---

## Workflow Integration

### Phase A: DESIGN — Identify Tiers Upfront

#### A1. PRD: Test Coverage Plan (NEW Requirement)
- PRD must specify which tests are **Tier 1** (critical) vs **Tier 2** (edge cases)
- Mark tests as:
  ```
  Tier 1 (BLOCKING):
  - User can create a ticket [happy path]
  - API validates required fields [400 error]
  - Response matches OpenAPI spec [contract]

  Tier 2 (ASYNC):
  - Edge case: title with 10,000 characters
  - Edge case: simultaneous creation from 100 users
  - Edge case: database timeout → retry logic
  - Coverage: 80%+ of feature code
  ```
- Rationale: Engineering knows upfront what's critical vs nice-to-have
- **Success Metric:** PRD clearly separates Tier 1 from Tier 2

#### A4. QA MANAGER TEST VALIDATION
- **Reviews Tier 1 + Tier 2 plan separately:**
  - **Tier 1 Tests:** Must be implementable, tests are syntactically correct
  - **Tier 2 Tests:** Must be documented (can be TODO initially)
- **Outputs:** "QA VALIDATION APPROVED" with tier breakdown
  - "Tier 1: 5 tests identified (happy path + 3 error cases)"
  - "Tier 2: 8 edge cases documented for Track C"

---

### Phase B: IMPLEMENT — Build & Validate Tier 1

#### B6.5. SENIOR QA TEST PLANNING
- **Separates tests by tier:**
  - Tier 1: Must be completed in B8 (before shipping)
  - Tier 2: Can be deferred to Track C (post-ship)
- **Outputs:** Test update plan with tier labels
  ```
  TIER 1 (Must complete by B8):
  - test_create_ticket_happy_path() [happy path]
  - test_create_ticket_missing_required_field() [validation]
  - test_create_ticket_api_response_schema() [contract]

  TIER 2 (Complete in Track C):
  - test_create_ticket_long_title()
  - test_create_ticket_concurrent_100_users()
  - test_create_ticket_db_timeout_retry()
  ```

#### B8. UPDATE TESTS
- **Tier 1 Only:** Implement all Tier 1 tests identified in B6.5
- **Tier 2 Stub:** Create skeleton test files with TODO comments
  ```python
  def test_create_ticket_long_title():
      """TODO: Test title with 10,000 characters"""
      pass

  def test_create_ticket_concurrent_100_users():
      """TODO: Test race condition from 100 concurrent requests"""
      pass
  ```
- **Run Tests:**
  - `pytest -m "tier1"` — MUST pass 100%
  - `pytest -m "tier2"` — Can be failing/skipped (expected)
  - Tier 1 coverage: 40%+ (verified)
  - Tier 2 coverage: 0% (stubs only)

**Gate Rule:** TPPM accepts feature ONLY if **Tier 1 tests pass 100%**

---

### Phase C: SHIP

#### C1. DOCS & COMMIT
- PRD documents: "Tier 1 tests passing (100%), Tier 2 deferred to Track C"
- Code merged to `main` with Tier 1 passing
- Tier 2 test files exist as stubs (marked as TODO)

---

### Track C: TEST COMPLETION (NEW Track — Parallel to Closer & Feedback)

**Trigger:** TPPM outputs "FEATURE ACCEPTANCE APPROVED"

**Responsible Agent:** Test Completion Subagent (Haiku)

**Execution Model:** Runs in parallel with:
- Track A (Closer) — docs, artifact cleanup
- Track B (Flink Developer) — stress testing
- Does NOT block Track 5 (next feature Phase 1)

#### C1. Receive Gap List
- QA Manager provides list of Tier 2 tests + coverage gaps
- Example:
  ```
  Tier 2 Tests Needed:
  - test_create_ticket_long_title (title with 10k chars)
  - test_create_ticket_concurrent_100_users (race condition)
  - test_create_ticket_db_timeout_retry (network resilience)
  - test_create_ticket_special_characters (unicode: emoji, RTL)
  - test_create_ticket_performance (sub-100ms on 1M tickets)

  Coverage Gaps:
  - Line 45: error handling for null requester_id
  - Line 78: retry logic not tested
  - Lines 120-145: unicode handling untested
  ```

#### C2. Implement Tier 2 Tests
- Replace TODO stubs with real test implementations
- Cover all Tier 2 edge cases from gap list
- Ensure tests use same markers as Tier 1 (for consistency)
- Example:
  ```python
  @pytest.mark.tier2
  @pytest.mark.feature_tickets_v2
  def test_create_ticket_long_title():
      """Test that titles with 10,000 characters are handled correctly."""
      long_title = "x" * 10000
      response = create_ticket(title=long_title)
      assert response.status_code == 201
      assert response.json()["title"] == long_title

  @pytest.mark.tier2
  @pytest.mark.feature_tickets_v2
  def test_create_ticket_concurrent_100_users():
      """Test that concurrent ticket creation from 100 users works."""
      with ThreadPoolExecutor(max_workers=100) as executor:
          futures = [
              executor.submit(create_ticket, title=f"Ticket {i}")
              for i in range(100)
          ]
          results = [f.result() for f in futures]
      assert all(r.status_code == 201 for r in results)
      assert len(results) == 100
  ```

#### C3. Run Full Test Suite
- `pytest -m "feature_tickets_v2"` — Run all tests (Tier 1 + Tier 2)
- **Success Criteria:**
  - Tier 1: 100% pass (already passing from Phase B)
  - Tier 2: 100% pass (newly fixed)
  - Overall coverage: 80%+ (stretch goal: 90%+)
- **Output:**
  - Test execution report (pass/fail counts)
  - Coverage report (lines covered %)
  - Gap list (remaining untested scenarios, if any)

#### C4. Deliver Final Test Suite
- Commit Tier 2 test implementations to `main`
- Update test report in feature PRD
- Example:
  ```
  ## Test Results (Track C Completion)

  Tier 1 Tests: 5/5 passing (100%)
  Tier 2 Tests: 8/8 passing (100%)
  Total: 13/13 passing (100%)

  Code Coverage: 84% (target: 80%+)
  - Lines covered: 210/250
  - Functions covered: 18/19
  - Untested: null fallback in edge case (low risk)

  Track C Completed: [Date]
  Status: Ready for next cycle
  ```

**Success Metric:** 100% test pass rate, 80%+ code coverage achieved by end of Track C.

---

## Phase Summary

| Phase | Tier 1 Status | Tier 2 Status | Shipping Decision |
| :--- | :--- | :--- | :--- |
| **Phase B (Implement)** | ✅ 100% pass | 📝 Stubs only | ✅ Ship (Tier 1 validates feature works) |
| **Track C (Post-Ship)** | ✅ 100% pass | ✅ 100% pass | ✅ Production-ready (full coverage) |

---

## QA Gates (Updated)

### Gate 1: A4 QA Manager Validation (PRD Sign-Off)
- **Blocking:** Tier 1 test plan is clear + implementable
- **Blocking:** Tier 2 test plan is documented
- **Output:** "QA VALIDATION APPROVED" with tier breakdown
- **If Blocked:** PRD needs revision to clarify tiers

### Gate 2: B8 Tier 1 Test Pass
- **Blocking:** All Tier 1 tests pass 100%
- **Blocking:** Tier 1 coverage ≥ 40%
- **Output:** `pytest -m "tier1"` report showing 100% pass
- **If Blocked:** Engineering fixes tests before shipping

### Gate 3: B9 UX Sign-Off + Screenshots
- **Blocking:** UX Designer + Architect approve feature
- **Blocking:** Screenshots validated by QA Manager
- **Output:** "UX SIGN-OFF APPROVED"
- **If Blocked:** UX fixes needed before shipping

### Gate 4: C3 Tier 2 Test Completion (Post-Ship)
- **Non-Blocking:** All Tier 2 tests pass 100%
- **Non-Blocking:** Total coverage ≥ 80%
- **Output:** Final test report in feature PRD
- **If Missed:** Documented as technical debt (low priority)

---

## Key Rules

### Testing & Validation
- **Tier 1 is MANDATORY before shipping** — User-facing correctness
- **Tier 2 is OPTIONAL at shipping time** — Edge cases can be async
- **Tests must not fail silently** — Mark Tier 2 stubs with `@pytest.mark.skip` or `pytest.raises(NotImplementedError)`
- **All tests use markers** — `@pytest.mark.tier1`, `@pytest.mark.tier2` for easy filtering
- **Tier 1 = Happy Path + Critical Errors** — Cover primary use case + common validation failures
- **Tier 2 = Edge Cases + Robustness** — Cover rare scenarios, concurrency, performance

### Shipping & Quality
- **Ship with Tier 1 passing (100%)** — Users get a validated feature
- **Never ship with failing Tier 1 tests** — This is a blocker
- **Tier 2 gaps are acceptable at ship time** — But must be documented + completed in Track C
- **Track C is non-blocking** — Doesn't delay next feature Phase 1
- **Track C completion is tracked** — For quality metrics

### Async Execution
- **Track C runs in parallel with Closer + Feedback** — No sequential waiting
- **Track C completion should happen within 1 sprint** — Avoid accumulating untested code
- **Tier 2 gaps are logged** — If not completed, they show up as technical debt
- **Monthly review:** Are Track C items getting completed? If not, adjust Tier 1 scope for next features

---

## Example: Feature "Bulk Edit Tickets"

### A1: PRD Test Coverage Plan
```
Tier 1 (BLOCKING):
- User selects 5 tickets, bulk edits status → all updated [happy path]
- User tries bulk edit with no tickets selected → error message [validation]
- API bulk edit returns 200 with updated count [contract]
- Dark mode / responsive rendering verified in screenshots [UX]

Tier 2 (ASYNC Post-Ship):
- User bulk edits 1,000 tickets → performance verified
- Concurrent bulk edits from 10 users → no race conditions
- Network timeout during bulk edit → retry logic works
- Bulk edit with special characters in notes → unicode handled correctly
```

### B6.5: Test Planning
```
TIER 1 (Must complete by B8):
- test_bulk_edit_5_tickets_status_change() [happy path]
- test_bulk_edit_no_tickets_selected() [validation]
- test_bulk_edit_api_response_schema() [contract]

TIER 2 (Complete in Track C):
- test_bulk_edit_1000_tickets_performance()
- test_bulk_edit_concurrent_10_users()
- test_bulk_edit_network_timeout_retry()
- test_bulk_edit_unicode_special_chars()
```

### B8: Run Tests
```bash
pytest -m "tier1" --tb=short
# Output: 3/3 passing (100%) ✅

pytest -m "tier2" --tb=short
# Output: 4 skipped (TODO stubs)
```
**Result:** ✅ Ship feature (Tier 1 passing)

### Track C: Complete Tests
```bash
pytest -m "bulk_edit_feature" --tb=short
# Output: 7/7 passing (100%) ✅ Coverage: 82%
```
**Result:** ✅ Production-ready (Tier 2 complete)

---

## Metrics & Reporting

### Test Metrics to Track
- **Tier 1 Pass Rate at Ship Time** — Should be 100%
- **Time to Tier 1 Completion** — How long to get Tier 1 passing?
- **Time to Track C Completion** — How long for Tier 2 to be done?
- **Tier 2 Completion Rate** — % of features with Track C finished within 1 sprint
- **Code Coverage (Final)** — At Track C completion (target: 80%+)
- **Bugs Found in Tier 2** — Critical gaps? Adjust Tier 1 scope next time

### Monthly Review Questions
1. Are Tier 1 tests catching critical bugs? (yes = good tier split)
2. Are Tier 2 tests finding edge cases? (yes = good tier split)
3. Is Track C getting completed? (if <70% completed, Tier 1 scope is too small)
4. Are production bugs happening in Tier 2 gaps? (if yes, move those to Tier 1)

---

## Implementation Checklist

### For a New Feature

**Phase A:**
- [ ] PRD lists Tier 1 tests (happy path + critical errors)
- [ ] PRD lists Tier 2 tests (edge cases, rare scenarios)
- [ ] QA Manager approves both tiers

**Phase B:**
- [ ] B6.5 separates test plan by tier
- [ ] B8 implements all Tier 1 tests
- [ ] B8 creates Tier 2 test stubs (with TODO comments)
- [ ] Tier 1 passes 100% before acceptance
- [ ] Tier 2 is documented in gap list

**Phase C & Track C:**
- [ ] Feature shipped with Tier 1 passing (100%)
- [ ] PRD documents "Tier 1: shipping, Tier 2: Track C pending"
- [ ] Track C agent receives Tier 2 gap list
- [ ] Track C implements + completes Tier 2 tests (within 1 sprint)
- [ ] Final test report shows Tier 1 + Tier 2 both at 100%

---

## FAQ

**Q: Can we skip Tier 2 entirely?**
A: Yes, if the feature is low-risk (read-only operations, no data mutations, no third-party APIs). But document why Tier 2 was skipped. High-risk features (payment, auth, data deletion) should never skip Tier 2.

**Q: What if Tier 1 tests fail?**
A: Feature cannot ship. Fix the tests or reduce scope. Tier 1 = definition of done.

**Q: What if Tier 2 isn't completed by end of sprint?**
A: Log it as technical debt. Review in monthly retrospective. If it happens repeatedly, Tier 1 scope is too small — move more tests to Tier 1 for next features.

**Q: How do we know if the tier split is right?**
A: Track bugs found post-ship. If they're mostly in Tier 2 areas, split is good. If bugs are in Tier 1 areas, Tier 1 scope was too small.

**Q: Can we move tests between tiers after starting?**
A: Yes, if discovered during B6.5 or B8. If a Tier 2 test reveals a critical bug, move it to Tier 1 for that feature + note for future features.
