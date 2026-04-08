The script in scripts/bulk-index.js takes multiple days to run, and the database connection often drops before the index is completed. add a command line argument that would turn on dbRestartMode, which should run the db queries ordered by id, and somehow keep track of the last successfully processed id. when the db connection drops, the script should wait a few minutes, and restart the script from that id. if the db connection is not able to reconnect, script should log the last successfully processed id. the script should also have a way to restart manually provided a specific id.

Here is the rebuilt, step-by-step implementation plan based on the above requirements. As requested, the logic for automatically handling database drops is built first, and all requirements regarding the manual restartFromId feature have been isolated into their own dedicated step at the end.

Step 1: Add the Auto-Restart Command-Line Argument
Update the minimist configuration at the top of bulk-index.js to accept the --dbRestartMode boolean argument. Also, update the usage() function so that developers know how to activate this mode.

Step 2: Enforce Query Ordering
Modify the buildSqlQuery function to enforce ordering when dbRestartMode is active. If the flag is set and options.orderBy hasn't been explicitly defined, default options.orderBy to 'id'. This ensures the database processes records sequentially, which is required for resuming.

Step 3: Track the Last Successfully Processed ID
Inside the updateByBibOrItemServiceQuery function, initialize a lastProcessedId variable before the while (!done) loop starts. After indexer.processRecords successfully finishes processing a batch, extract the maximum id from the current batch of records and update lastProcessedId.

Step 4: Implement Auto-Restart on Dropped Connections
Wrap the cursor reading (readCursorRecurser) and batch processing logic in a try...catch block. When a database connection error is caught and dbRestartMode is true:

Cleanly close the existing cursor and release the client back to the pool.
Use the existing delay() utility to pause execution for a few minutes (e.g., await delay(180000)).
Re-establish the database connection pools via db.initPools().
Recursively call the query function again, passing along the lastProcessedId as the starting point.
Add a retry counter to this recursion. If the script attempts to reconnect and fails 3-5 times consecutively, break the loop, shut down the pools, and strictly log: "Database reconnection failed permanently. Last successfully processed ID: [lastProcessedId]".
Step 5: Implement Manual Restart (restartFromId)
This step introduces the restartFromId parameter, which handles both manual CLI restarts and the recursive handoff from Step 4.

Add --restartFromId to the minimist string arguments parsing block.
Modify buildSqlQuery so that if options.restartFromId is present, it dynamically appends an AND id > $X (or WHERE id > $X) clause to the query array, passing the ID into the params array.
Update the recursion logic from Step 4 so that when it calls updateByBibOrItemServiceQuery, it sets options.restartFromId = lastProcessedId to leverage this new SQL filter.