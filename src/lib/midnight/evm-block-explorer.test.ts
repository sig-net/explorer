import { MidnightNetwork } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import {
  etherscanAddressUrl,
  etherscanBroadcastUrl,
  etherscanTransactionUrl,
} from './evm-block-explorer'

const ADDRESS = '0xCAE822d4c5858b5d8E3b648E008c0Af7577e7B59'

test.for([
  [MidnightNetwork.Mainnet, `https://etherscan.io/address/${ADDRESS}`],
  [MidnightNetwork.Stagenet, `https://sepolia.etherscan.io/address/${ADDRESS}`],
  [MidnightNetwork.Preview, `https://sepolia.etherscan.io/address/${ADDRESS}`],
  [MidnightNetwork.Preprod, `https://sepolia.etherscan.io/address/${ADDRESS}`],
  [MidnightNetwork.Undeployed, `https://sepolia.etherscan.io/address/${ADDRESS}`],
] as const)('%s opens %s', ([network, url]) => {
  expect(etherscanAddressUrl(network, ADDRESS)).toBe(url)
})

const TRANSACTION_HASH = '0x84e8c369f283eb7ca26693d0db2092e121407d140a9a4657ac7780182f963f13'

test.for([
  [MidnightNetwork.Mainnet, `https://etherscan.io/tx/${TRANSACTION_HASH}`],
  [MidnightNetwork.Stagenet, `https://sepolia.etherscan.io/tx/${TRANSACTION_HASH}`],
] as const)('a transaction on %s opens %s', ([network, url]) => {
  expect(etherscanTransactionUrl(network, TRANSACTION_HASH)).toBe(url)
})

test.for([
  [MidnightNetwork.Mainnet, 'https://etherscan.io/pushTx?hex=0x02f8'],
  [MidnightNetwork.Stagenet, 'https://sepolia.etherscan.io/pushTx?hex=0x02f8'],
] as const)('a signed transaction on %s is broadcast from %s', ([network, url]) => {
  expect(etherscanBroadcastUrl(network, '0x02f8')).toBe(url)
})
