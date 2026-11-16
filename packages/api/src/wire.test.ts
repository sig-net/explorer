import { describe, expect, it } from 'vitest'

import { textWithoutUrlCredentials } from './wire.ts'

describe('textWithoutUrlCredentials', () => {
  it('cuts the user, the password, the query string and the fragment of each url', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['a://u:p@h/x?k=v#f', 'a://h/x'],
      ['a://b@c://d@e', 'a://c://e'],
      ['1://u@h?k', '1://u@h?k'],
      ['v1.a+b-c://u@h', 'v1.a+b-c://h'],
      ['a?b://c?d', 'a?b://c'],
      ['a://u@h/p@q', 'a://h/p@q'],
      ['a://h?k=v).', 'a://h).'],
      ['a://h?)x', 'a://h'],
      ['see a://h#f, then b://u:p@h', 'see a://h, then b://h'],
      ['HTTPS://U:P@H/X?K=V', 'HTTPS://H/X'],
    ]
    for (const [text, cut] of cases) {
      expect(textWithoutUrlCredentials(text)).toBe(cut)
    }
  })

  it('cuts a text of a million characters within 100 ms', () => {
    const texts = [
      'a'.repeat(1_000_000),
      'a://'.repeat(250_000),
      `a://b?${')'.repeat(1_000_000)}x`,
      `a://${'b@'.repeat(500_000)}`,
      `${'1'.repeat(1_000_000)}://user@host`,
      `${'a://b'.repeat(200_000)}?k=SECRET`,
    ]
    for (const text of texts) {
      const started = performance.now()
      textWithoutUrlCredentials(text)

      expect(performance.now() - started).toBeLessThan(100)
    }
  })
})
