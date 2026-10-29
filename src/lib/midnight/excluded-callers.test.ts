import { expect, test } from 'vitest'

import { parseContractAddressHex } from './contract-address'
import { DEFAULT_EXCLUDED_CALLERS } from './excluded-callers'

test('every default excluded caller is a contract address in canonical form', () => {
  expect(DEFAULT_EXCLUDED_CALLERS.length).toBeGreaterThan(0)
  for (const caller of DEFAULT_EXCLUDED_CALLERS) {
    expect(parseContractAddressHex(caller)).toBe(caller)
  }
})
