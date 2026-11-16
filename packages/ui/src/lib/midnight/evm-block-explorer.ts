import { MidnightNetwork } from '@sig-net/midnight'

/** Etherscan for Midnight mainnet, Sepolia Etherscan for every other Midnight network. */
function etherscanOrigin(network: MidnightNetwork): string {
  return network === MidnightNetwork.Mainnet
    ? 'https://etherscan.io'
    : 'https://sepolia.etherscan.io'
}

/** The Etherscan page of an EVM transaction, on the Ethereum network paired with `network`. */
export function etherscanTransactionUrl(network: MidnightNetwork, transactionHash: string): string {
  return `${etherscanOrigin(network)}/tx/${transactionHash}`
}

/**
 * Etherscan's broadcast page with `signedTransaction` filled in. Opening it sends nothing: the
 * visitor broadcasts from that page.
 */
export function etherscanBroadcastUrl(network: MidnightNetwork, signedTransaction: string): string {
  return `${etherscanOrigin(network)}/pushTx?hex=${signedTransaction}`
}

/** The Etherscan page of an EVM address, on the Ethereum network paired with `network`. */
export function etherscanAddressUrl(network: MidnightNetwork, address: string): string {
  return `${etherscanOrigin(network)}/address/${address}`
}
