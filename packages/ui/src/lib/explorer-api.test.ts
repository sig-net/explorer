import { expect, test } from 'vitest'

import { parseExplorerApiUrl } from './explorer-api'

test('an http or https URL is the explorer API URL, and anything else is none', () => {
  expect(parseExplorerApiUrl(' https://explorer.example/api ')).toBe('https://explorer.example/api')
  expect(parseExplorerApiUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/')
  expect(parseExplorerApiUrl(undefined)).toBeNull()
  expect(parseExplorerApiUrl('')).toBeNull()
  expect(parseExplorerApiUrl('explorer.example')).toBeNull()
  expect(parseExplorerApiUrl('ftp://explorer.example')).toBeNull()
})
