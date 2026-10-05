import { expect, test } from 'vitest'

import { STAGENET_REQUEST } from './sign-bidirectional-event.fixture'
import { signBidirectionalEventJson } from './sign-bidirectional-event-json'

test('a padded text field renders as its text', () => {
  expect(signBidirectionalEventJson(STAGENET_REQUEST).executionDest).toBe('eip155:1')
})

test('a field whose bytes are not text renders as hex, padding included', () => {
  const executionDest = new Uint8Array(32)
  executionDest.set([0xff, 0xfe, 0x00, 0x41])
  expect(signBidirectionalEventJson({ ...STAGENET_REQUEST, executionDest }).executionDest).toBe(
    `fffe0041${'00'.repeat(28)}`,
  )
})
