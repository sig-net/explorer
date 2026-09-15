import { isNotFound } from '@tanstack/react-router'
import { expect, test } from 'vitest'

import { NETWORK_IDS, isNetworkId, parseNetworkId } from './networks'

test('every declared network id is accepted', () => {
  for (const id of NETWORK_IDS) {
    expect(isNetworkId(id)).toBe(true)
    expect(parseNetworkId(id)).toBe(id)
  }
})

test('unknown ids throw the router not-found signal', () => {
  expect(isNetworkId('ethereum')).toBe(false)

  let thrown: unknown = null
  try {
    parseNetworkId('ethereum')
  } catch (error) {
    thrown = error
  }
  expect(isNotFound(thrown)).toBe(true)
})
