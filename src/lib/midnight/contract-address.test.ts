import { expect, test } from 'vitest'

import { parseContractAddressHex } from './contract-address'

const ADDRESS = 'ab'.repeat(32)

test('a contract address parses from hex in any case, with or without the prefix', () => {
  expect(parseContractAddressHex(ADDRESS)).toBe(ADDRESS)
  expect(parseContractAddressHex(` 0x${ADDRESS.toUpperCase()} `)).toBe(ADDRESS)
})

test('anything but 32 bytes of hex is not a contract address', () => {
  expect(parseContractAddressHex('')).toBeNull()
  expect(parseContractAddressHex('abab')).toBeNull()
  expect(parseContractAddressHex(`${ADDRESS}ab`)).toBeNull()
  expect(parseContractAddressHex(`${ADDRESS.slice(2)}zz`)).toBeNull()
})
