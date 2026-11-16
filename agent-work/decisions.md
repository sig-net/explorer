# Decisions

Append only. An agent that disagrees with an entry reports it and never acts against it.

`Decided by` is `user`, `planner` for how the thing is built, `planner (unconfirmed)` for what changes what the user gets until they have confirmed it, then `planner (confirmed)`, or `orchestrator` during execution.

| No. | Decision | Why | Decided by |
| --- | --- | --- | --- |
| D01 | The explorer gets a long running Node backend and a SQL database. The UI reads Midnight data from the backend alone. | Since the ledger 9 upgrade no public Midnight node or indexer serves a browser, and the tool must stay available to clients of the sig integration. | user |
| D02 | The earlier attempt's `agent-work/` is removed unread, and the design starts again from the code and the conversation. | The user's instruction. | user |
| D03 | The database is PostgreSQL. | A long running server with one writer per network and concurrent readers, trigram search and JSON aggregation, all measured in A5. | planner (unconfirmed) |
| D04 | Networks are separated by one PostgreSQL schema per network, with identical tables. | A wipe is one `DROP SCHEMA`, no query can forget a network filter, and one set of migrations serves every network. Named tables per network would need the same statements generated per name. | planner (unconfirmed) |
| D05 | The request list is served from a `requests` table the ingest transaction maintains, one row per request id, and the `lifecycle` view joins each row to its events. The table is written by the backend's code inside the ingest transaction, with no database trigger. | A5: a plain view took 1.4 to 3.1 s at 1.5 million requests, the table under 4 ms. Application code keeps the aggregation in one tested place and the table can be rebuilt from `events`. | planner (unconfirmed) |
| D06 | The cursor of a network moves in the same SQL transaction that stores everything read up to it, and only when it still holds the value the read started from. | A crash or a failed read then leaves the cursor before the missing data, and two backends cannot both advance it. | planner (unconfirmed) |
| D07 | The backend inspects each request's transaction when it ingests it and stores the request record. The browser stops loading the ledger WebAssembly. | The raw transaction came from the indexer, which the browser can no longer reach, and the inspection of a finalised transaction never changes. | planner (unconfirmed) |
