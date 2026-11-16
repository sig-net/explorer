# Explorer UI

The explorer's browser app: a React single-page application. On Midnight it lists the requests the
backend has indexed and checks each signature and attestation in the browser. Run it as the
repository's [README](../../README.md) describes. Why it is built this way is recorded in
[DECISIONS.md](../../DECISIONS.md).

## Stack

| Concern              | Tool                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| UI                   | React 19.3 with the React Compiler enabled                                     |
| Build and dev server | Vite 8 (Rolldown bundler) with `@vitejs/plugin-react` 6                        |
| Language             | TypeScript 7 (native compiler), strict mode                                    |
| Routing              | TanStack Router, file based, routes in `packages/ui/src/routes`                |
| Styling              | Tailwind CSS 4 through `@tailwindcss/vite`                                     |
| Tests                | Vitest 5 in browser mode (Chromium via Playwright) with `vitest-browser-react` |
| Lint and format      | Oxlint (type aware) and Oxfmt                                                  |

At the root, `yarn dev:ui`, `yarn build` and `yarn preview` run the app's scripts. `yarn test:watch`
belongs to the app alone: run it as `yarn workspace @sig-net/explorer-ui test:watch`.

## Configuration

Vite reads `packages/ui/.env.local` (ignored by git) and inlines every `VITE_` value into the
build. Restart `yarn dev:ui` after editing it, or let it restart on its own when the file changes.

| Variable                                       | Value                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `VITE_EXPLORER_API_URL`                        | The backend's http or https URL, without the `/v1` of its routes (`http://127.0.0.1:8080`)             |
| `VITE_MIDNIGHT_DEFAULT_NETWORK`                | The network the app opens on: `undeployed`, `preview`, `preprod` or `mainnet`. `preprod` when unset    |
| `VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY`    | Preprod's MPC root public key. The key the SDK publishes when unset                                    |
| `VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL`   | Preprod's MPC output cache. The URL the SDK publishes when unset                                       |
| `VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY` | A local `undeployed` stack's MPC root public key, which every stack generates afresh. Empty when unset |
| `VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL`       | The EVM RPC endpoint for Ethereum mainnet. A keyless public node when unset                            |
| `VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL`       | The EVM RPC endpoint for Sepolia. A keyless public node when unset                                     |

Without `VITE_EXPLORER_API_URL`, or with a value that is not an http or https URL, the app reads no
backend: the explorer page says so and lists nothing. A value that is not a valid secp256k1 public
key, network id or http URL stops the app from loading, and the error names the variable. Each
variable read is declared in `packages/ui/src/vite-env.d.ts`.

The backend must allow the app's origin in its `EXPLORER_CORS_ORIGINS`: `http://localhost:5173`
for the dev server.

**Warning:** every `VITE_` value ends up in the browser, inlined into the build or served in the
image's `env.js`, so anyone who can load the app can read it. A keyed RPC URL is readable by every
visitor: keep keyed URLs to `.env.local` and local use unless publishing them is intended.

## Docker image

`packages/ui/Dockerfile` builds the app into a standalone image: the production build, served by
nginx on port 8080 as a single page application, with no build step at run time. Its build context
is the repository root. Build and run it locally from the root with:

```bash
docker build -f packages/ui/Dockerfile -t explorer .
```

```bash
docker run --rm -p 127.0.0.1:8081:8080 --env-file packages/ui/.env.local explorer
```

It serves the app on <http://127.0.0.1:8081/>, an origin the backend must then list in its
`EXPLORER_CORS_ORIGINS`.

The image takes the variables above from its runtime environment, so one image serves every
configuration. At start, `packages/ui/docker/30-explorer-env.sh` writes every `VITE_MIDNIGHT_*` and
`VITE_EXPLORER_*` variable it finds into `env.js`, which `index.html` loads before the app.
`packages/ui/src/lib/explorer-env.ts` reads that object over the values inlined at build time, so a
variable set on the container wins over one an env file held when the image was built, and an unset
one leaves the build's value in place. The `env.js` in `packages/ui/public` sets nothing, so the dev
server and GitHub Pages take the build's values alone.

## Base path and deep links

GitHub Pages serves the site under `/explorer/`, not at a domain root. The build reads the path it is
served under from `EXPLORER_BASE_PATH` (default `/`, and it must start and end with a slash): Vite
prefixes every emitted asset with it, the router takes it as its base path, and `publicAssetUrl` in
`packages/ui/src/lib/public-asset-url.ts` prefixes files from `packages/ui/public`. To try a sub-path
build locally:

```bash
EXPLORER_BASE_PATH=/explorer/ yarn build && EXPLORER_BASE_PATH=/explorer/ yarn preview
```

Pages serves `404.html` for any path that is not a file, so the deploy workflow copies `index.html`
to `404.html`. A link such as `/explorer/midnight/explorer?requestId=...` then loads the app, which
routes it. The response carries the status 404, which browsers show as one console error and
otherwise ignore.

The footer shows the build's version. A release build takes it from `EXPLORER_VERSION`. A build
without that variable describes its checkout instead, as the latest release tag and the short
commit (`v1.2.0-bc90655`), with `vX.X.X` standing in while the checkout has no release tag.

## Canonical Tailwind classes

`yarn lint` also checks that every Tailwind class is written in its canonical form, the check the
Tailwind CSS IntelliSense extension surfaces as `suggestCanonicalClasses`. It comes from
`eslint-plugin-better-tailwindcss`, which Oxlint loads as a JS plugin, and only that plugin's
`enforce-canonical-classes` rule is switched on. A non-canonical class fails the run, and
`yarn lint --fix` rewrites it: `[&>[data-slot=table-container]]:h-full` becomes
`*:data-[slot=table-container]:h-full`.

The rule reads the theme from `packages/ui/src/index.css`, so an arbitrary value that names a theme
token is reported as well: `bg-[var(--color-clamshell-100)]` is flagged in favour of
`bg-clamshell-100`.

`packages/ui/src/components/ui` is exempt, since the shadcn CLI writes those files and they are not
hand edited here.

## Theme and palette

`packages/ui/src/index.css` declares every sig.network colour scale (brand, clamshell, dark-neutral,
the near-white tints, and the error, gray-blue, success and warning utility scales) as Tailwind
theme tokens, so classes such as `bg-clamshell-100` or `text-dark-neutral-400` work anywhere. The
shadcn semantic variables (`--background`, `--primary`, `--muted` and so on) are mapped onto those
scales for the light theme under `:root` and for the dark theme under `.dark`.

The theme is a class on the root element. `ThemeProvider` in
`packages/ui/src/components/contexts/ThemeContext.tsx` reads the stored choice, falls back to the
system preference, and the toggle in the app bar flips it and persists it in local storage.

Typography follows the sig.network brand assets in Notion: Elza Text for interface text and Söhne
Mono for hashes, identifiers and other technical content.

- Elza Text is served by the sig.network Adobe Fonts kit, linked from `packages/ui/index.html`, and
  reached through the `font-sans` utility (`--font-sans` in `packages/ui/src/index.css`). The kit
  provides weights 300 to 700 in upright and italic.
- Söhne Mono is licensed from Klim Type Foundry. Its WOFF2 files live in `packages/ui/src/fonts` and
  are declared with `@font-face` at the top of `packages/ui/src/index.css`, reached through the
  `font-mono` utility. Weights 200 (Extraleicht), 300 (Leicht), 400 (Buch) and 500 (Kräftig) are
  included.

Tailwind leaves buttons on the default cursor, and shadcn pins `cursor-default` on menu and select
items. One unlayered rule at the end of `packages/ui/src/index.css` gives every enabled control a
click activates (buttons, tabs, menu items, select options and their kin) the pointer cursor.
Disabled controls keep their own cursor.

To add a shadcn component, run the CLI from `packages/ui`, where `components.json` lives:

```bash
yarn dlx shadcn@latest add dropdown-menu
```

## Networks

Supported networks are declared once in `packages/ui/src/lib/networks.ts`, which owns the id set,
display labels and icon paths. Icons live in `packages/ui/public/icons`. Midnight and sig.network
ship black and white variants, swapped by the dark class, and Solana uses one icon for both themes.

## Midnight

Signet runs as two contracts. Requester contracts notify the signer of their requests, and the
signer emits the Sign Bidirectional Events. The MPC posts its responses through the responder, which
emits the Signature Responded and Respond Bidirectional Events. The backend reads both and serves
them grouped by request.

The selected network is owned by the URL: every `/midnight` page carries `?networkId=<network>`. A
missing or unknown value is rewritten to the default network before the page loads, and the route
layout copies the validated value into the context.

### The backend's networks

`ExplorerApiProvider` in `packages/ui/src/components/contexts/ExplorerApiContext.tsx` holds the
client of the backend `VITE_EXPLORER_API_URL` names (`packages/ui/src/lib/explorer-api.ts`), or
null when none is configured. Read it with `useExplorerApi`.

`MidnightProvider` in `packages/ui/src/components/contexts/MidnightContext.tsx`, mounted at the root,
holds the selected network, the browser's own configuration for it (below), and the networks the
backend serves, each with its server configuration and sync state, read once at load and again on
Refresh. Read it with `useMidnight`.

The page shows how far the backend has indexed the selected network beside the counts: "Indexed to
block N" with the block's time and the sync state (`syncing`, `synced` or `stopped`), or "Nothing
indexed yet" before the first read. When the backend has stopped the network, or its latest read
failed, an alert gives the backend's reason. A network the backend does not serve shows an alert in
place of the list, and the network select marks it unavailable.

### The configuration popover

The cog at the right of the Midnight bar opens the configuration popover. Changing its network
rewrites the query string of the current page.

Its "Indexed by the backend" section shows the selected network's signer and responder addresses,
starting block and source URL, read only: they are the backend's configuration, and the source URL
comes without its query string. The section says so when the backend does not serve the network,
cannot be reached or is not configured.

Below it are the fields the browser itself reads with, editable: MPC Root Public Key, Ethereum
Mainnet RPC URL, Ethereum Sepolia RPC URL and MPC Output Cache URL. Their defaults come from
`packages/ui/src/lib/midnight/network.ts`: the SDK's published values where there are any, the
variables above, and keyless public EVM nodes. Edits live in memory, per network, until the page
reloads, and Reset Defaults drops them. The popover marks the MPC root public key invalid while it
is not a key: any spelling the SDK accepts (SEC1 hex, compressed or uncompressed, or NEAR's
`secp256k1:<base58>`) is valid.

### WebAssembly and bundle weight

The first page load carries one WebAssembly module, the 1.6MB onchain runtime
(`@midnightntwrk/onchain-runtime-v4` 4.0.1), inside about 3.1MB of output, and the build emits no
other `.wasm` file. Keep it that way when adding Midnight features. The app imports no Midnight
ledger: the backend reads transactions and serves what it found.

`@sig-net/midnight` loads the onchain runtime through the Compact runtime. Vite's dependency
optimizer cannot inline it, so `packages/ui/vite.config.ts` adds `vite-plugin-wasm` and keeps that
package out of the prebundle. The rest of the SDK tree is still optimized, which matters because it
includes CommonJS packages.

`@midnight-ntwrk/midnight-js-indexer-public-data-provider` is the package to watch. A static import
of it pulls in `@midnight-ntwrk/midnight-js-types`, which imports the Midnight ledger as runtime
values. Measured at 5.0.0-beta.6, that added two builds of the ledger WebAssembly (20.8MB, one of
them never fetched) plus Apollo Client, taking the output to 22.4MB. A feature that needs that
provider loads it with a dynamic `import()` inside the route that needs it, so the weight stays off
the first page load. Check the `.wasm` files listed by `yarn build` after adding any Midnight
dependency.

## The request list

`MidnightLifecyclesProvider` in `packages/ui/src/components/contexts/MidnightLifecyclesContext.tsx`,
mounted at the root, reads the selected network's request lifecycles from the backend, newest
first, 50 at a time. A "Load more" button under the table reads the next 50. Refresh reads the
networks, the first page and the callers again, and keeps what is shown until the answers arrive.
Read it with `useMidnightLifecycles`.

A lifecycle is every event that declares one request id: lists of Sign Bidirectional Events,
Signature Responded Events and Respond Bidirectional Events, each with the block and transaction
that emitted it, and for each notification what the backend read in its transaction. The grouping
lives in `packages/lib/src/midnight/sign-bidirectional-lifecycle.ts`, and the decoding of events in
`packages/lib/src/midnight/signet-events.ts`. Each kind is a list since the signer and responder are
unauthenticated: nothing stops a kind being emitted twice under one request id, or a response being
emitted for a request that never was, and the lifecycle keeps all of it so such cases can be seen.
The grouping is by declared id only and verifies nothing.

The search box searches by a fragment of a request id or of a caller contract address, and the
backend answers it once the typing has rested for 300 ms. A fragment of fewer than 3 characters is
no search: the list shows every request, and a line under the box asks for at least 3 characters.
The status line beside it gives the matching and total counts of events and requests.

The filter button at the end of the table's header row opens a panel under the header, shows as
pressed while the panel is open, and carries a bright bubble with the number of excluded callers
while there are any. Hovering it says how many filters are active, or "Show more filters" when none
is. Its Exclude callers box takes a caller contract address, typed in full or picked from the
callers the backend lists as the typed fragment narrows them (a `0x` prefix and letter case are
ignored), and Enter, the button beside the box or a pick excludes it. Each excluded caller is a chip
whose cross lets it back in. The backend leaves the excluded callers' requests out of the rows and
of the matching counts. The panel is `ExcludedCallersFilter` in
`packages/ui/src/components/midnight/excluded-callers-filter.tsx`, built from the shadcn
`Combobox`, `Badge` and `Toggle` components.

`SignBidirectionalLifecycleTable` in
`packages/ui/src/components/midnight/sign-bidirectional-lifecycle-table.tsx` renders one row per
lifecycle. The table fills the height the page has left below the search and status line, with a
sticky header, and scrolls inside its body. The app shell in `packages/ui/src/routes/__root.tsx` is
exactly one viewport tall, which is what gives the table a height to fill. While the first page is
read the table shows a loading splash ("Loading Sig Network events", `SpinnerSplash` in
`packages/ui/src/components/spinner-splash.tsx`), then "No requests yet" or "No requests match the
search" when there is nothing to show.

Times are block times as `DD-MM-YY HH:MM:SS` in the browser's time zone, a cell lists at most three
entries before an ellipsis, each signature time carries how long after the request it came, a clock
marks a signature or response that has not arrived (hovering it says what is being waited for), and
Duration runs from the first request to the first response. Hovering a truncated request id or
caller shows the full value, and the copy button beside it puts the full value on the clipboard. The
eye button after a caller's copy button hides all requests from that caller, which adds it to the
excluded callers. The link button beside a request id copies a URL to share, naming the selected
network and that request, and the button after it opens that URL in a new tab. The display
formatters live in `packages/ui/src/lib/format.ts`.

A lifecycle can hold responses and no request notification: the MPC answering a request notified on
another Signet signer, or anyone posting a response for a request that never was. Its row says so in
place of the request time, caller and duration, and the expanded notification section says what is
missing.

Expanding a row shows one section per event kind, with a numbered tab per event: the contract that
emitted it, as a Signet Signer or Signet Responder badge, and where the event was emitted
(transaction hash, block hash, block height, block time), then every field of its decoded record. A
kind with no event shows a clock.

### Transaction inspection

The Sign Bidirectional Notification section also shows what the emitting transaction did. The
backend reads it from the transaction's own bytes when it stores the event, and serves two things
with each notification:

- The call chains. Every contract call carries its entry point name and address. A caller's
  transcript claims each call it makes by callee address, entry point hash and communication
  commitment, and a call matching all three is nested under its caller. Calls nobody claims are the
  top level calls, and each is listed as its own chain, separated by a divider.
- The request at the requests path: the value of the caller's map insert whose path equals the
  notification's requests path and whose key equals the request id. The browser decodes it with
  the SDK's `decodeEvmType2SignBidirectionalEvent` and shows it as JSON
  (`packages/ui/src/lib/midnight/sign-bidirectional-event-json.ts`: bytes as hex, text fields as
  text, integers as numbers while exactly representable) in a viewport that scrolls both ways.

When the backend could not inspect the transaction, the section says why.

Above the JSON, the Signing Key and Signing Key Address lines show the request signing key, the key
the MPC derives for the request's `sender` and `path` and signs the requested transaction with: its
public key as uncompressed SEC1 hex, and that key's EVM address.
`packages/ui/src/lib/midnight/request-signing-key.ts` derives both from the configured MPC root
public key with the SDK's `deriveSignBidirectionalEventSigningKey` and
`deriveSignBidirectionalEventSignerEvmAddress`, so the Signing Key line asks for a valid root key
while the configuration holds none. Each of the two labels has an info icon whose tooltip says what
the value is and how the two differ. The address carries a link to its Etherscan page
(`packages/ui/src/lib/midnight/evm-block-explorer.ts`): Etherscan when the selected Midnight network
is mainnet, Sepolia Etherscan for every other network.

The JSON viewport resizes vertically by dragging its bottom right corner (the browser's own resize
grip). Two buttons float in the bottom right corner of the viewport
(`packages/ui/src/components/midnight/sign-bidirectional-request-json.tsx`): one copies the whole
JSON, indented, and one opens the same tree in a dialog sized to 90% of the window.

### Signature check

The Signet contracts' events are unauthenticated: anyone can post a Signature Responded Event
declaring any request id. Under each posted signature, the Signature Check list judges it against
every Sign Bidirectional Notification of the same request id, numbered as the notification tabs are.
For each notification it takes the request record from the transaction inspection, derives that
request's signing key, and asks the SDK's `verifySignatureRespondedEvent` whether the signature,
over the transaction the request describes, recovers to that key
(`packages/ui/src/lib/midnight/signature-check.ts`). A line reads "valid for key" or "not valid for
key" with the key it was judged against. A notification whose transaction stores no request has
nothing to check.

A valid line also carries the EVM transaction hash, with a link to the transaction on Etherscan. The
hash is the Keccak-256 of the signed transaction's bytes, signature included, so it exists only for
a request paired with a signature, never for a request alone, and it is shown only where that
signature is valid. The SDK's `signBidirectionalEventToSignedEvmTransaction` assembles the signed
transaction. The hash says what the transaction's id is, not that anyone broadcast it: Etherscan
finds nothing for a signed transaction that was never sent.

Next comes the Signed Txn line: the raw signed transaction, as the hex a node's
`eth_sendRawTransaction` takes, with a copy button.

Below the hash, the On Chain line asks an EVM RPC node what became of the transaction, with a
spinner while it waits and a button to ask again
(`packages/ui/src/lib/midnight/evm-transaction-status.ts`). The node is chosen by the request's own
`txParams.chainId`: the configuration holds one endpoint for Ethereum mainnet (chain 1) and one for
Sepolia (chain 11155111), both defaulting to keyless public endpoints that accept calls from a
browser, or to the ones the environment names, and both editable in the configuration popover. A
request for any other chain says it has no endpoint.

| Node reports                                         | Line                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| A receipt with status 1                              | submitted, succeeded, with block, confirmations and finality  |
| A receipt with status 0                              | submitted, reverted, with block, confirmations and finality   |
| No receipt, and it holds the transaction in a block  | included with an unknown outcome: the node pruned the receipt |
| No receipt, and it holds the transaction in no block | submitted, waiting for a block                                |
| Nothing, and the sender's nonce has passed it        | not found, and another transaction has used its nonce         |
| Nothing                                              | not found by this node, with the submittable verdict below    |
| An error, or no answer                               | could not check, with the reason                              |

A transaction the node does not know, whose nonce is still free, gets a verdict: "still
submittable", or "not submittable as things stand" with the reasons. The reasons are a gap before
its nonce (the sender's next nonce is lower), a balance below the gas limit at the maximum fee plus
the value, and a maximum fee below the latest block's base fee. Beside the verdict, a link opens
Etherscan's broadcast page with the signed transaction filled in (`etherscanBroadcastUrl` in
`packages/ui/src/lib/midnight/evm-block-explorer.ts`). The explorer itself never broadcasts: the
visitor sends from Etherscan's page. Broadcasting is permanent, and a signed transaction can be
sent by anyone who holds it.

A mined transaction is laid out as a block explorer does: a status badge, the block with its
confirmations and finality as badges, and how long ago it was included with the exact local time.
That time is the block's timestamp, since the chain does not record when a transaction was first
sent. Confirmations count the blocks from the transaction's block to the node's head, both
included, and a transaction is finalised when its block is at or below the node's `finalized`
block. The line is best effort and its info icon says so: it is one node's view, "not found" and
"could not check" never mean "not submitted", and a block can still be reorganised away until it is
finalised. Public endpoints are rate limited and see only their own pending pool, so set a keyed
endpoint when the answer matters.

### Attestation check

A Respond Bidirectional Event is the MPC's attestation of what the foreign transaction did. It
declares the request id, the height of the finalised target-chain block, an output kind, the byte
width and hash of the serialised output and the digest the signature is over, followed by the
signature. The output kind is the MPC's verdict:

| Output kind | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| Executed    | The transaction was finalised and succeeded                                  |
| Failed      | The transaction was finalised and reverted, and the output is empty          |
| Unviable    | Another signet request's transaction took the nonce, and the output is empty |

The event's own fields are shown as declared, and the responder emits them unverified. Under each
event, the Attestation Check judges it in two steps
(`packages/ui/src/lib/midnight/attestation-check.ts`).

The first step needs nothing from the foreign chain. The response key is derived with the SDK's
`deriveMidnightResponseKey` from the configured MPC root public key and the notification's caller
address, under the reserved path "midnight response key". It is fixed for a contract, and it is
shown on every line that has a valid root key. The SDK's `verifyRespondBidirectionalAttestation`
then says whether the signature is by that key over the request id, block height, output kind,
output width and output hash the event declares. A line reads "valid for response key" or "not
valid for response key", and a valid line states the verdict in words with the target block height,
since both are covered by the signature.

The second step, for a valid attestation that declares output bytes, obtains those bytes and asks
the SDK's `verifyAttestedOutput` whether they have the declared width and hash. An attestation that
declares a width of zero is over no bytes, so nothing is obtained for it: every failed and unviable
attestation, and an executed one whose transaction returns nothing. The bytes come from:

- The MPC's output cache. The MPC writes each request's attested bytes to a public bucket before it
  posts the attestation, at `<cache URL>/<network id>/<signer address>/<request id>.bin`, under the
  Signet signer's address, not the responder's. The SDK's `MpcOutputCacheReader` reads it
  (`packages/ui/src/lib/midnight/mpc-output-cache.ts`) from the MPC Output Cache URL in the
  configuration, which defaults to the one the SDK publishes for the network and is empty where it
  publishes none. The bytes come serialised, so this route shows no decoded output.
- A trace of the transaction. The signed transaction's hash comes from the valid signature
  responses, and its top call frame is read with `debug_traceTransaction` from the EVM RPC endpoint
  configured for the request's chain (`packages/ui/src/lib/midnight/evm-transaction-output.ts`).
  The SDK reads the frame by the MPC's own rules (`evmTraceOutputFromCallFrame`) and rebuilds the
  attested bytes from it (`executedEvmRespondOutput`): the return data decoded by the request's
  output deserialisation schema, then Borsh serialised with one member per schema field.
  `deserializeEvmOutput` gives the decoded output that is shown beside the bytes.

| Finding                                                 | Line                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| The signature is not by the response key                | not valid, with the reason                                                      |
| The signature is valid and the output declares no bytes | valid, with the verdict and no attested bytes                                   |
| The obtained bytes have the declared width and hash     | valid, with the attested bytes and their source                                 |
| The obtained bytes differ in width or hash              | valid, and the output from that source is not the attested one, with the reason |
| The attestation declares bytes and none were obtained   | valid, and attested bytes not obtained, with both reasons                       |

A trace whose top call errored yields no executed output, so it counts as an output that is not the
attested one. Hosted nodes often gate `debug_traceTransaction`, the default public endpoints among
them, so without the cache the bytes of an executed attestation are obtained only once the
configuration names an endpoint that serves it. The bucket must allow cross-origin reads: a browser
cannot read an object from a bucket without a CORS policy, whatever the object's status. The tab of
an event with a valid attestation is green, as the tab of a valid signature response is.

## Local SDK link

The explorer depends on the published `@sig-net/midnight`. To try SDK changes that are not released
yet, link a local checkout of the `sig-net/midnight-integration` repository. The link is a local
arrangement and is never committed.

Add `portal:` resolutions to the root `package.json` for the SDK and for its sibling
`@sig-net/midnight-serde`, which the SDK depends on as a workspace package, beside the resolutions
already there. Paths are relative to the repository root, here for a checkout named
`midnight-integration` sitting beside it:

```json
"resolutions": {
  "@sig-net/midnight": "portal:../midnight-integration/packages/signet-midnight",
  "@sig-net/midnight-serde": "portal:../midnight-integration/packages/midnight-serde-ts"
}
```

Then install:

```bash
yarn install
```

A portal consumes the SDK as TypeScript source, and the SDK declares enums, so set
`erasableSyntaxOnly` to `false` in `packages/ui/tsconfig.app.json` while the link is in place. Vite
erases the enums, and the published package is unaffected since it ships compiled JavaScript. To return to the published package, remove the two
resolutions, restore `erasableSyntaxOnly`, and run `yarn install` again.

Yarn holds back any package published within the last 24 hours. `.yarnrc.yml` pre-approves the
`@sig-net` scope, so a fresh SDK release installs at once while every other package keeps that
protection.

## Routing

Files under `packages/ui/src/routes` map to URLs by name: `index.tsx` is `/`, `solana.tsx` is
`/solana`, and `__root.tsx` is the layout every route renders inside. `index.tsx` renders nothing:
it redirects `/` to `/midnight` with the default network, and bare `/midnight` redirects on to
`/midnight/explorer`, so a visitor landing on the site arrives at the Midnight explorer.
`midnight.tsx` is the layout for every `/midnight` page: it renders the Midnight bar with the
Explorer and Contract Analyser tabs, and the files under `packages/ui/src/routes/midnight` are the
tab pages. The Solana page carries a coming soon banner while its explorer is being built. The
switcher in the top app bar navigates between network roots, and the current network is derived
from the first path segment, so loading a network URL directly selects that network. The Vite
plugin regenerates `packages/ui/src/routeTree.gen.ts` whenever a route file changes. That file is
committed so a fresh checkout type-checks before the first dev server run, and it is excluded from
lint and format.

The explorer page takes an optional `requestId` query parameter, so a request can be linked to:
`/midnight/explorer?networkId=preprod&requestId=<64 hex digits>`. The page reads that request from
the backend by its id and shows it alone, expanded, or "Request not found". The id fills the search
box, and the first edit to the box removes the parameter from the address bar and returns to the
list. A value that is not a request id is dropped from the URL, and one spelled with `0x` or
capitals is rewritten in canonical form.

The page also takes an optional `excludeCallers` query parameter, a comma-separated list of caller
contract addresses whose requests the filter panel hides:
`/midnight/explorer?networkId=preprod&excludeCallers=<64 hex digits>,<64 hex digits>`. The
parameter is the filter's value: the panel opens with those callers excluded, and excluding or
restoring a caller rewrites it. Entries that are not contract addresses are dropped, duplicates are
kept once, and `0x`, capitals and spaces are rewritten in canonical form.

A row that is the only result of a search starts expanded, and it collapses again when the search
widens. A row toggled by hand keeps that choice. Without a search nothing opens by itself.

Route components are code split automatically, so each route ships as its own chunk.

## Tests

Test files match `packages/ui/src/**/*.test.tsx` and `packages/ui/src/**/*.test.ts` and run in a
real Chromium. Render with `render` from `vitest-browser-react`, query with `page` from
`vitest/browser`, and assert with `expect.element`, which retries until the assertion passes or
times out. The browser's time zone is fixed to `Asia/Kolkata`, so a time that depends on the zone
is checked against one zone everywhere. A test reads the backend through the in-memory service of
`@sig-net/explorer-api/testing`, so the UI's tests need no backend and no database.
