import { type AbiDecodedOutput, type AbiDecodedValue, bytesToHex } from '@sig-net/midnight'

import { type JsonInteger, jsonInteger } from '@/lib/midnight/sign-bidirectional-event-json'

type AttestedOutputJsonValue = JsonInteger | boolean | AttestedOutputJsonValue[]

/** A decoded output as plain JSON: integers as {@link JsonInteger}, bytes as hex. */
export type AttestedOutputJson = Record<string, AttestedOutputJsonValue>

function valueJson(value: AbiDecodedValue): AttestedOutputJsonValue {
  if (typeof value === 'bigint') {
    return jsonInteger(value)
  }
  if (value instanceof Uint8Array) {
    return bytesToHex(value)
  }
  return Array.isArray(value) ? value.map(valueJson) : value
}

export function attestedOutputJson(output: AbiDecodedOutput): AttestedOutputJson {
  return Object.fromEntries(Object.entries(output).map(([name, value]) => [name, valueJson(value)]))
}
