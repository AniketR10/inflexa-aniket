## Context

`linkPackagesIntoFarm` resolves each query with `resolvePackageRequest`, over
the pool index of the graph. The harness now gives `imagePoolIndex` and
`joinPoolIndexes`, and the planner joins the two indexes at the submit.

## Goals / Non-Goals

**Goals:**

- The seam route gives the answer of the submit for each entry.

**Non-Goals:**

- A change to `store link` or to `store add`. An interactive command asks about
  the pool, and the image is not a part of the pool.

## Decisions

### The ladder runs one time over the joined index

The seam route joins the image index to the graph index, and it calls
`resolveQuery` one time. The switch over the answer moves into one function
that `resolvePackageRequest` and the seam route both call. Thus the two routes
share the version pick and the error shapes.

An alternative was a lookup of the image before the ladder. That lookup gives a
different answer for a spelling that the graph and the image both hold, thus
the join is better.

### An image package is `present`, not `linked`

The farm links a store directory, and the image package has none. The runtime
of the image already loads it. Thus the outcome is `present`, and its version
is the runtime version of the track in the record.

### The image answers a version and an ambiguity by the rules of the pool

The image holds one version of a base package, which is the version of its
runtime. A pin of another version refuses with `unknown_version`, thus a pinned
entry reads alike on the two paths.

An `ambiguous` answer can name one track of the pool and one track of the
image. The image track holds no store directory, thus the shared switch over
the graph shelves cannot answer it. The seam route builds that refusal itself,
and the claim of the image track names the runtime of the image. The remedy of
the refusal stays the prefix.

### A missing record gives an empty image index

A store from before the record, or a record that does not parse, gives an index
that holds nothing. Then the seam gives the answer of the graph alone.

## Risks / Trade-offs

- [The record of the store and the image of the sandbox come from two builds] →
  The catalog build copies the record of the image that it packs beside. Thus
  the two sets agree for one store.
