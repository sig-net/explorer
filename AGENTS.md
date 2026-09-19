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
- Keep heavy SDK assemblies off the first page load. A static import of
  `@midnight-ntwrk/midnight-js-indexer-public-data-provider` drags the Midnight ledger WebAssembly
  (about 20MB) and Apollo Client into the importing chunk, even when only constructed. Never import
  it, or anything that reaches `@midnight-ntwrk/midnight-js-types` at runtime, from shared or
  root-mounted code. A feature that needs it loads it with a dynamic `import()` inside its own
  route. The Midnight ledger WebAssembly (`@midnightntwrk/ledger-v9`, about 10MB) follows the
  same rule: only `src/lib/midnight/sign-bidirectional-transaction-inspection.ts` imports it as
  values, and that module is reached by dynamic `import()` alone. After adding any Midnight
  dependency, run `yarn build` and check the emitted `.wasm` files: the expected set is the
  onchain runtime, plus one ledger build referenced only by the lazy inspection chunk.
- Match names to actual responsibilities. Adding a variant reopens sibling and container names.
  Qualify both members when introducing a qualified twin. Moves, deletions and renames require a
  whole-repository search for invalidated names and updates to imports, configuration, manifests,
  tests and documentation in the same change.

## UI components

- Every UI element is built from shadcn/ui components. Before building anything, check
  `src/components/ui` for the component it needs. If it is not there, install it with the shadcn
  CLI (`yarn dlx shadcn@latest add <component>`) rather than writing it by hand.
- If shadcn has no component for what is asked, stop and say so. Do not invent a substitute,
  hand-roll a primitive, or pull in another component library.
- Never put a cursor class on a control. One unlayered rule at the end of `src/index.css` gives
  every enabled clickable control the pointer cursor, by element and ARIA role, and it outranks
  the `cursor-default` utility shadcn sets on menu and select items. A per-component
  `cursor-pointer` hides a gap in that rule from every other component with the same gap. When a
  control lacks the pointer, add its element or role to that rule's selector list. Disabled
  controls keep their own cursor: keep the rule's `:not(...)` exclusions intact.

## File layout

- File code by what it is and who owns it, never by feature name. `src/lib` holds every
  non-React module: domain sets, defaults, parsers, formatters. A domain with several modules
  gets a folder under it (`src/lib/midnight/`). `src/components` holds React components,
  `src/components/ui` only what the shadcn CLI writes, `src/components/contexts` React
  contexts, and `src/routes` route files only. Do not create new top-level folders under `src`
  for a feature; the folder name is decided by the kind of code, then the domain.
- Split files by ownership, not by export type. A React context, its provider and its accessor
  hook are one unit with one owner and always change together, so they live in one file:
  `src/components/contexts/<Name>Context.tsx` exporting the value type, the provider and the
  `use<Name>` hook. The same holds for any cluster that only ever changes as a whole. Split a
  file only when a piece gains a consumer that must not import the rest (a non-React runtime, a
  test that must avoid JSX). The Fast Refresh lint warning about mixed exports is not a reason
  to split; it is switched off for `src/components/contexts`.
