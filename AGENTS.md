# Engineering rules

Apply these requirements to new and changed code. Existing violations are not precedent.
Keep setup instructions and application reference material in README.md and docs/.

## Precise types

- Preserve precise types through every application boundary. Explicitly type function parameters
  and returns, shared interfaces, context values and generic SDK specialisations. Local variables
  and contextually typed callbacks may use inference when it retains the precise type.
- Do not use `any`, explicitly or through unsafe assignments, arguments, returns, calls or member
  access. Do not use `unknown` to avoid resolving an SDK, generated contract or application type.
  Search installed declarations and existing exports. Carry generated circuit, private-state,
  provider, contract and ledger types through their consumers without widening them.
- Permit `unknown` only at designated external-input validation and caught-error handling
  boundaries. Narrow or validate it there before returning domain values. A new boundary exception
  requires explicit review and a documented reason. Do not spread `unknown` through domain APIs.
- Type assertions must have a demonstrated invariant the compiler cannot express. Never use
  double casts, non-null assertions, suppression comments or lint/configuration changes to conceal
  a mismatch. Fix the contract or validate the value. An annotation receiving `any` is not proof
  of safety. Preserve strict TypeScript and unchecked-index checking.
- Define each closed set once using an authoritative enum, literal union or constant object.
  Reuse dependency-owned sets and handle meaningful variants exhaustively. Model unavailable
  capabilities explicitly instead of implementing throwing placeholders behind a broad interface.

## Boundaries and ownership

- Before changing shared code, census its actual consumers, including browser, server, tools and
  tests. Record runtime, environment and required capabilities. Replan for unexpected consumers.
  Search dependency exports and sibling modules before creating a shared helper, type or constant.
- Keep generic capabilities independent of application policy. Configuration, wallet lifecycle,
  contract binding, balance queries, funding and operation orchestration have separate owners.
  Provider composition must respect those dependencies. Prove an extracted generic boundary can
  operate without the feature that prompted its extraction.
- Components render precise props and compose UI. Local presentation state may remain local.
  Reusable React behaviour belongs in hooks, domain mechanics in non-React modules, and shared
  operations in owners that survive individual consumer mounts. Add a provider or abstraction
  only for a demonstrated ownership need. Share code at the second real consumer.
- Keep public configuration, browser SDK assembly and server secrets separate. Shared modules
  must work in every consuming runtime. Pass validated immutable configuration into resources.
  Apply related edits atomically and invalidate only affected sessions. Browser input cannot
  redefine server funding authority or privileged configuration.
- Match names to actual responsibilities. Adding a variant reopens sibling and container names.
  Qualify both members when introducing a qualified twin. Moves, deletions and renames require a
  whole-repository search for invalidated names and updates to imports, configuration, manifests,
  tests and documentation in the same change.