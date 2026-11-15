# Pack: the service pattern (`packages/api` and everything that touches it)

## The idea

A service is an interface. The backend implements it over repositories. The UI calls the same
interface through an HTTP implementation. Neither side knows the other exists. The `api` package
is that contract and nothing else.

```
ui component -> XService (interface, api)
                   |- XServiceHttpImpl (api)  --HTTP-->  Fastify route (backend)
                   |                                        -> XServiceAdaptor (api)
                   |                                            -> XServiceImpl (backend) -> repositories
                   |- XServiceFakeImpl (api, fixtures, for UI work and tests)
```

## Files per resource, in `packages/api`

| File | Holds |
| --- | --- |
| `<resource>.ts` | The resource's zod schema and its inferred type. Supporting value schemas above it when they are evaluated at load time |
| `<resource>-service.ts` | The service interface, each method's args schema and args type, each method's result type |
| `<resource>-service-adaptor.ts` | Takes `unknown` from the wire, parses it with the args schema, calls the service, returns a result value |
| `<resource>-service-http-impl.ts` | Implements the interface with `fetch`, parses the reply with the resource schema |
| `<resource>-service-fake-impl.ts` | Implements the interface in memory over fixtures |

The backend adds `<resource>-service-impl.ts` in its own package.

`[read]` the demo's `activity-v1/activity-service.ts` (interface and args schemas in one file) and
`activity-v1/activity-service-adaptor.ts` (parses `unknown`, returns `{ ok: true, ... }` or
`{ ok: false, error }`). The HTTP and fake implementations have no counterpart in the demo.

## Rules

- **The schema is parsed at every boundary where data is untrusted:** the adaptor parses args
  from the wire, the HTTP implementation parses the reply. Inside the backend, types are plain
  TypeScript. `[read]` the demo's engineering rules ("Validation boundaries").
- **Results are values.** A method that can fail for a reason the caller handles returns
  `{ ok: false, error }` through the adaptor. HTTP status is 200 for any reply the adaptor
  produced. A crash is a 500 with no detail.
- **Wire format** (`agent-work/architecture.md` section 7): bytes as lowercase hex without `0x`,
  times as ISO 8601 strings, integers that may exceed 2^53 as decimal strings. Block heights and
  positions fit in a JSON number.
- **One route per method:** `POST /<service>/<method>`, body is the args object. The route table
  is exported from `api` so the host and the client cannot disagree on a path.
- **`api` imports no framework:** no Fastify, no Drizzle, no React, no `pg`, no Node built-ins
  that a browser lacks. It must bundle for the browser and run in Node.
- **`api` and `lib` never import the ledger WebAssembly** (`@midnightntwrk/ledger-v9`) or anything
  that reaches it.
- **Closed sets are defined once,** as a constant array with a derived union, and the zod enum is
  built from that array. The database schema builds its text enums from the same array.
- **Never return a secret:** no indexer URL, no RPC URL. A host name is the most that leaves.
- **The fake is a real implementation.** It honours paging, search and filters over its fixtures,
  so UI built against it behaves the same against the backend. Adding the fake beside the HTTP
  implementation makes two implementations: both carry a qualifier in their names.

## The services

`agent-work/architecture.md` section 7 lists them: Network, Sign request, Midnight transaction,
Ethereum transaction output. Stage 03 fixes their exact shapes and records them there.

## Naming

- Service: `SignRequestService`. Implementations: `SignRequestServiceImpl` (backend),
  `SignRequestServiceHttpImpl`, `SignRequestServiceFakeImpl`. Adaptor: `SignRequestServiceAdaptor`.
- Args: `listSignRequestsArgsSchema`, `ListSignRequestsArgs`.
- Files in kebab-case, named after the declaration they exist for, which comes first in the file.
