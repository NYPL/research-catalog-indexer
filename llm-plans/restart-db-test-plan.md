### Testing Strategy & Mocking Setup

To accurately test `dbRestartMode` without requiring a live database or Elasticsearch instance, we will need to heavily mock the script's dependencies.

**Required Mocks/Stubs:**
1. **`db` object:** Stub `db.initPools`, `db.endPools`, and `db.connect`. `db.connect` should return a mock client with a `release` method.
2. **`pg-cursor` (Cursor):** Mock the cursor instance and its `read` method. We can program this mock to return records successfully or throw connection errors on demand to simulate database drops.
3. **`indexer`:** Stub `indexer.processRecords` to resolve successfully, or throw errors if we want to test Elasticsearch timeouts.
4. **`logger`:** Spy on `logger.info`, `logger.warn`, and `logger.error` to assert that the correct messages and `lastProcessedId`s are being logged.
5. **`delay` utility:** Stub the `delay` function so that the test doesn't actually wait 3 minutes (`180000` ms) when a connection drops. It should just resolve immediately.

---

### Phase 1: Unit Tests for `buildSqlQuery`

These tests will ensure that the SQL query string is generated correctly when the new arguments are provided.

**Expectations:**
* **Appends `ORDER BY`:** When `options.dbRestartMode` is `true` and `options.orderBy` is not provided, the returned query string should end with `ORDER BY id`.
* **Respects existing `ORDER BY`:** When `options.dbRestartMode` is `true` but `options.orderBy` is explicitly set to `updated_date`, it should order by `updated_date` (not `id`).
* **Appends `restartFromId` clause:** When `options.restartFromId` is provided (e.g., `1000`), the query string should include `AND id > $X` (or `WHERE id > $X`) and the `params` array should include `1000`.

---

### Phase 2: Mocked Functional Tests for `updateByBibOrItemServiceQuery`

These tests will simulate the actual batching process and evaluate how the script behaves under different network conditions when `dbRestartMode` is active.

#### Scenario 1: No connections dropped
**Setup:** Mock `cursor.read()` to return 3 batches of mock records (e.g., IDs 1-100, 101-200, and an empty array `[]` to signal completion).
**Expectations:**
* `cursor.read()` is called exactly 3 times.
* `indexer.processRecords` is called exactly 2 times with the correct data.
* The script exits cleanly without calling `db.initPools` (no reconnection attempted).
* `logger.warn` or `logger.error` are *never* called.

#### Scenario 2: Single connection dropped
**Setup:** Mock `cursor.read()` to return the first batch successfully (IDs 1-100), but throw a "Connection terminated" error on the second call. Program the *new* cursor (spawned after the restart) to return IDs 101-200, and then an empty array `[]`.
**Expectations:**
* **Error caught:** The script catches the connection error and calls `logger.warn` indicating an attempt to reconnect.
* **State tracking:** The script correctly identifies `lastProcessedId` as `100` (the highest ID from the first successful batch).
* **Reconnection logic executed:** `delay(180000)` and `db.initPools()` are called.
* **Recursive resume:** The script recursively calls `updateByBibOrItemServiceQuery` with `options.restartFromId` set to `100`.
* **Success:** The process ultimately finishes successfully, logging the final "Cursor reached the end" message.

#### Scenario 3: Three connections dropped (Permanent Failure)
**Setup:** Mock `cursor.read()` to return the first batch successfully (IDs 1-100). Then, force `cursor.read()` to throw connection errors for *every* subsequent call, regardless of how many times the script restarts.
**Expectations:**
* **Repeated retries:** The script catches the error, logs a warning, waits, re-initializes pools, and restarts up to 3 times.
* **Counter increments:** Ensure the `options._reconnectRetries` increments correctly (`1`, `2`, `3`).
* **Permanent failure logged:** On the 3rd failure, the script evaluates `reconnectRetries >= 3` and calls `logger.error`.
* **Last Processed ID validation:** The error log explicitly matches the string: `"Database reconnection failed permanently. Last successfully processed ID: 100"`.
* **Graceful shutdown:** `db.endPools()` is called and the script returns/exits without crashing the Node process with an unhandled exception.

#### Scenario 4: Connection drops before any records are processed
**Setup:** Mock `cursor.read()` to throw an error immediately on the very first batch. Set it to fail permanently.
**Expectations:**
* The script fails after 3 retries.
* `logger.error` is called.
* The logged `lastProcessedId` is `null` (or `undefined`), safely handling the edge case where no records were ever processed before the database went offline.

---

### Phase 3: Secondary Disasters in `index.js` and Beyond

Because a database drop is never the only thing that goes wrong, we must also simulate failures in the broader ecosystem—specifically the Elasticsearch indexer and the various prefetchers.

#### Scenario 5: Elasticsearch Takes a Personal Day (`elastic.writeRecords` fails)
**Setup:** Mock `elastic.writeRecords` (or `elastic.updateRecords`) in `index.js` to reject its promise with a timeout or connection error.
**Expectations:**
* The inner `try...catch` in `bulk-index.js` catches the error.
* The script retries `indexer.processRecords` exactly 3 times, with a 3-second delay between attempts.
* After 3 failures, the error bubbles up to the outer `catch` block.
* The `dbRestartMode` logic takes over, waits 3 minutes, and treats it just like a database drop—reinitializing the pool and restarting from the `lastProcessedId`.

#### Scenario 6: SQS Stream Throws a Tantrum (`emitBrowseTerms` failure)
**Setup:** Mock `SQSClient.send` inside `lib/browse-terms/index.js` to throw an error.
**Expectations:**
* The error is caught by the internal `try...catch` inside `emitBrowseTerms`.
* A `logger.error` is triggered.
* The batch **does not** fail, `indexer.processRecords` resolves successfully, and the script moves on to the next batch. (It's a silent tragedy, really).

#### Scenario 7: The Prefetcher Drops the Ball (`sierraItemsByBibIds` failure)
**Setup:** Force a database error not on the main cursor, but on the `itemService` connection pool used during `modelPrefetch`.
**Expectations:**
* `indexer.processRecords` fails during the record building phase.
* The local retry loop in `bulk-index.js` attempts it 3 times.
* The error bubbles up to the main try/catch, triggering the standard `dbRestartMode` 3-minute backoff, pool reinitialization, and recursive resume.
