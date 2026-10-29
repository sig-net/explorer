/**
 * The callers whose requests the explorer hides until a user lets them back in: contracts whose
 * traffic is noise beside the requests a reader comes for.
 */
export const DEFAULT_EXCLUDED_CALLERS: readonly string[] = [
  // The Sig pinger, which requests a signature every minute to watch the MPC's liveness.
  '708ce2c97e54a491f3f5bc48cdb3fbb05ae8c3f86ae87bde113bf66fde357989',
]
