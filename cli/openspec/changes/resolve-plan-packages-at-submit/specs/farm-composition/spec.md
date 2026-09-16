## ADDED Requirements

### Requirement: The seam route counts an image package as present

The seam route MUST read the image record at the root of the store. It MUST
join `imagePoolIndex` of the harness to the pool index of the graph with
`joinPoolIndexes`. It MUST resolve each query one time over the joined index.
When the answer is `resolved` and the graph does not hold the identity, the
outcome MUST be `present`. Its version MUST be the runtime version of the
track in the record, and the seam MUST link nothing for it.

The image holds one version of a base package: the version of its runtime.
Thus a query that pins a different version MUST refuse with `unknown_version`.

An `ambiguous` answer of the joined index MUST report a collision that names
the two prefixed forms. One track of the pair can be a base package of the
image, and that track holds no store directory. The claim of such a track MUST
name the runtime of the image. Thus the caller reads the one remedy of a
two-track spelling, which is the prefix.

A record that is absent or that does not parse MUST give an index that holds
nothing. `store link` and `store add` MUST resolve over the graph alone.

#### Scenario: A base R package is present

- **GIVEN** a store whose record holds `stats` in `r_base` and the R runtime `4.6.0`
- **WHEN** the seam receives a query with the spelling `stats` and the track `r`
- **THEN** the outcome is `present` with the version `4.6.0`, and the farm links nothing

#### Scenario: A standard-library module is present

- **GIVEN** a store whose record holds `json` in `python_stdlib`
- **WHEN** the seam receives a query with the spelling `json`
- **THEN** the outcome is `present`

#### Scenario: A pin of a version that the runtime does not hold refuses

- **GIVEN** a store whose record holds `stats` in `r_base` and the R runtime `4.6.0`
- **WHEN** the seam receives a query with the spelling `stats`, the track `r`, and the version `3.0.0`
- **THEN** the outcome is `absent`

#### Scenario: A spelling that the pool and the image hold in two tracks collides

- **GIVEN** a store whose Python track holds `beta` and whose record holds `beta` in `r_base`
- **WHEN** the seam receives a query with the spelling `beta` and no track
- **THEN** the outcome is a `collision` whose detail names `python:beta` and `r:beta`
- **AND** the claim of the R track names the R runtime of the image

#### Scenario: A store with no record keeps the answer of the graph

- **GIVEN** a store with no image record
- **WHEN** the seam receives a query with the spelling `stats` and the track `r`
- **THEN** the outcome is `absent`
