import { expect, test } from 'vitest'

import { parseContractAddressHex, parseContractAddressesHex } from './contract-address'

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

test('a comma-separated list yields its distinct addresses in canonical form, dropping the rest', () => {
  const other = 'cd'.repeat(32)
  expect(
    parseContractAddressesHex(`${ADDRESS}, 0x${other.toUpperCase()},${ADDRESS},nope,`),
  ).toEqual([ADDRESS, other])
  expect(parseContractAddressesHex('')).toEqual([])
  expect(parseContractAddressesHex('abab,,')).toEqual([])
})
