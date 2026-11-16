-- Runs with the network's schema first on the search path. Hashes, addresses and payloads are
-- bytea. A request id and a caller are lower case hex text, which the trigram indexes search.

CREATE TABLE ingest_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  genesis_hash bytea NOT NULL,
  signer_address bytea NOT NULL,
  responder_address bytea NOT NULL,
  start_block bigint NOT NULL,
  cursor_height bigint,
  cursor_hash bytea,
  cursor_block_time timestamptz,
  tip_height bigint,
  state text NOT NULL,
  last_success_at timestamptz,
  last_error text,
  CHECK (num_nulls(cursor_height, cursor_hash, cursor_block_time) IN (0, 3))
);

CREATE TABLE transactions (
  hash bytea PRIMARY KEY,
  block_height bigint NOT NULL,
  block_hash bytea NOT NULL,
  block_time timestamptz NOT NULL,
  raw bytea,
  inspection jsonb
);

CREATE TABLE events (
  id bigint PRIMARY KEY,
  transaction_hash bytea NOT NULL REFERENCES transactions (hash),
  contract_roles text[] NOT NULL,
  name text NOT NULL,
  payload bytea NOT NULL,
  request_id text CHECK (request_id ~ '^[0-9a-f]{64}$'),
  decode_failure text,
  CHECK (request_id IS NULL OR decode_failure IS NULL)
);

CREATE INDEX events_request_id_id ON events (request_id, id);

CREATE TABLE requests (
  request_id text PRIMARY KEY CHECK (request_id ~ '^[0-9a-f]{64}$'),
  first_event_id bigint NOT NULL REFERENCES events (id),
  first_requested_at timestamptz,
  first_signature_at timestamptz,
  first_response_at timestamptz,
  sign_bidirectional_count integer NOT NULL DEFAULT 0,
  signature_responded_count integer NOT NULL DEFAULT 0,
  respond_bidirectional_count integer NOT NULL DEFAULT 0
);

CREATE INDEX requests_first_event_id ON requests (first_event_id DESC);
CREATE INDEX requests_request_id_trgm ON requests USING gin (request_id public.gin_trgm_ops);

-- One row for each caller contract address a notification of the request names.
CREATE TABLE request_callers (
  request_id text NOT NULL REFERENCES requests (request_id),
  caller text NOT NULL CHECK (caller ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (request_id, caller)
);

CREATE INDEX request_callers_caller_request_id ON request_callers (caller, request_id);
CREATE INDEX request_callers_caller_trgm ON request_callers USING gin (caller public.gin_trgm_ops);

-- Each element of `events` is one event of the API's lifecycle, in emission order.
CREATE VIEW lifecycle AS
SELECT requests.*, request_events.events
FROM requests
CROSS JOIN LATERAL (
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', events.id,
          'name', events.name,
          'payload', encode(events.payload, 'hex'),
          'transactionHash', encode(events.transaction_hash, 'hex'),
          'blockHeight', transactions.block_height,
          'blockHash', encode(transactions.block_hash, 'hex'),
          'blockTime',
          to_char(transactions.block_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'roles', to_jsonb(events.contract_roles)
        ) || CASE
          WHEN events.name <> 'SignBidirectionalEvent' THEN '{}'::jsonb
          WHEN transactions.inspection IS NULL THEN '{"inspection": {"failed": "not inspected"}}'::jsonb
          WHEN transactions.inspection ? 'failed' THEN
            jsonb_build_object(
              'inspection',
              jsonb_build_object('failed', transactions.inspection -> 'failed')
            )
          ELSE
            jsonb_build_object(
              'inspection',
              jsonb_build_object(
                'callChains', transactions.inspection -> 'callChains',
                'requestCell',
                coalesce(
                  transactions.inspection -> 'requestCells' -> events.id::text,
                  'null'::jsonb
                )
              )
            )
        END
        ORDER BY events.id
      ),
      '[]'::jsonb
    ) AS events
  FROM events
  JOIN transactions ON transactions.hash = events.transaction_hash
  WHERE events.request_id = requests.request_id
) AS request_events;
