## 1. The seam resolution

- [x] 1.1 In `src/modules/libs/composition.ts`, move the switch over a `QueryResolution` into one function. `resolvePackageRequest` calls it over the graph index.
- [x] 1.2 In the same file, make `linkPackagesIntoFarm` read the image record of the store. Join `imagePoolIndex` to the graph index, and resolve each query one time.
- [x] 1.3 In the same file, answer `present` with the runtime version for an identity that only the image holds. Link nothing for it.

- [x] 1.4 In the same file, refuse a pin of a version that the runtime of the image does not hold.
- [x] 1.5 In the same file, answer an `ambiguous` pair of the joined index with a collision. Name the runtime of the image as the claim of an image track.

## 2. The tests

- [x] 2.1 In `src/modules/libs/composition.test.ts`, add the three scenarios: a base R package is present, a standard-library module is present, and a store with no record keeps the answer of the graph.
- [x] 2.2 In the same file, add the two scenarios of the review: a pin of a version that the runtime does not hold refuses, and a two-source ambiguity reports a collision with both prefixed forms.

## 3. Verification

- [x] 3.1 Link the working-copy harness with `bun run harness:local`.
- [x] 3.2 Run `bun run format:file`, `bun run typecheck`, and the tests of `composition.test.ts`.
- [x] 3.3 Run `openspec validate resolve-plan-packages-at-submit --strict`.
