import { expect, test } from 'vitest'

import { NETWORK_IDS, NETWORKS, isNetworkId, networkFromPathname } from './networks'

test('every declared network is resolved from its route', () => {
  for (const id of NETWORK_IDS) {
    expect(isNetworkId(id)).toBe(true)
    expect(networkFromPathname(NETWORKS[id].route)).toBe(NETWORKS[id])
    expect(networkFromPathname(`${NETWORKS[id].route}/explorer`)).toBe(NETWORKS[id])
  }
})

test('unknown paths resolve to no network', () => {
  expect(isNetworkId('ethereum')).toBe(false)
  expect(networkFromPathname('/')).toBeNull()
  expect(networkFromPathname('/ethereum')).toBeNull()
})
