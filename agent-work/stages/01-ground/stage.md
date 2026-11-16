# Stage 01-ground

## Delivers

Proof that a subagent on each model follows a brief, and an answer to each assumption the design still rests on untested. No product code.

## Assumes

- The design is settled: `agent-work lint --design` passes.
- The dev secrets hold `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`, and it answers. [run 4234222]

## Shape

All three steps run side by side: each writes its own file under `agent-work/probes/`. Steps 01.1 and 01.2 start nothing. Step 01.3 runs one Node process for 30 minutes that makes about five requests every four seconds, and nothing else.

## Gates

After the three steps are merged, the orchestrator reads `probes/indexer-soak.out.json` and records one decision row per gate, each containing the words `gate A7`, `gate A8` or `gate A10`. The stage check requires the three rows.

- **gate A7: does the indexer add events at or below a tip it reported?** Read `lateEvents` and `vanishedEvents`.
  - Both 0: the ingest reads up to the tip. `tipMargin` defaults to 0 blocks.
  - `lateEvents` above 0: `tipMargin` defaults to twice `lateEventMaxBlocksBelowTip`, at least 10 blocks. Say so in step 04.2 when stage 4 is revised.
  - `vanishedEvents` above 0: the indexer served events that later disappeared, which no margin of ours explains. Stop and bring it to the user with the sample.
- **gate A8: is the indexer's tip finalised?** Read `tipAheadOfFinalityMaxBlocks` and `tipHashMismatches`.
  - Both 0: no change.
  - Ahead by n blocks with no mismatch: `tipMargin` is at least `n + 5`.
  - Any mismatch: a block the indexer served was replaced. `tipMargin` is at least 50 blocks (five minutes), and the cursor hash check of the design is what catches a deeper one. Record it for the user's closing report.
- **gate A10: does Blockfrost refuse requests at the planned rate?** Read `statuses`. The probe polls about seven times faster than the ingest will (D21).
  - Only 200: the default poll interval of 30 seconds stands.
  - Any 402 or 429: the default poll interval becomes 60 seconds, and the closing report tells the user that the token's plan refused requests at the probe's rate, with the count.
  - The daily quota itself cannot be read by a program. The closing report always asks the user to confirm that the plan allows about 11,000 requests a day per network.
