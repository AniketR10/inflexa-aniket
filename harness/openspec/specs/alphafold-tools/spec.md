# alphafold-tools Specification

## Purpose

Defines the harness tool `alphafold_prediction`, which wraps the AlphaFold
Protein Structure Database (AlphaFold DB) prediction API
(`https://alphafold.ebi.ac.uk/api/prediction`) of EMBL-EBI and DeepMind. Before
this tool the harness had no structural biology tool, thus an agent could not
tell a folded domain from a disordered loop. AlphaFold DB is keyless and
public, and it answers one unauthenticated GET, keyed by a UniProt accession.

The tool follows the harness tool-error contract literally. AlphaFold splits
absence over two status codes. An identifier that does not parse gives 400, and
a well-formed accession with no model gives 404. `isUnexpectedApiError`
classifies each `http_status` in the 4xx range as expected, thus both become
`ok({ found: false, uniprotAccession })` and not a thrown error.

An unexpected failure throws out of `execute` instead — a 5xx, a timeout, retry
exhaustion, or a schema mismatch. The agent loop then wraps it as a
`tool_result { is_error: true }`.

Two design decisions bind the tool. First, it returns model metadata,
confidence, and artifact URLs only. It never returns file contents. A
predicted `.pdb` or `.cif` file holds megabytes of coordinates. Those
coordinates give the model no benefit in a chat turn. A download of one
belongs in the sandbox instead.

Second, `globalMetricValue` is the mean pLDDT over the whole chain, not a
pass/fail confidence score. A low value can still be correct: BRCA1 scores
41.59, because BRCA1 is largely disordered. The tool description bands
the value:

- above 90 is very high
- 70 to 90 is confident
- 50 to 70 is low
- below 50 is very low or disordered

Thus an agent does not read a low score as a failed prediction.

Citations:

- Jumper and others, *Nature* 2021 (AlphaFold2)
- Varadi and others, *Nucleic Acids Research* 2024 (AlphaFold DB)

## Requirements

### Requirement: AlphaFold DB structure prediction tool

The system MUST give an `alphafoldPredictionTool` (on-wire id
`alphafold_prediction`, built with `defineTool`) that takes a required
`uniprotAccession` string. For an accession with a model it MUST return
`ok({ found: true, uniprotAccession, uniprotDescription, latestVersion,
modelCreatedDate, globalMetricValue, fractionPlddtVeryLow, fractionPlddtLow,
fractionPlddtConfident, fractionPlddtVeryHigh, pdbUrl, cifUrl, paeImageUrl,
amAnnotationsUrl? })`. For an accession with no model, and for an identifier
that does not parse, it MUST return `ok({ found: false, uniprotAccession })`.

#### Scenario: A canonical accession returns its model

- **WHEN** the tool is called with `uniprotAccession: "P69905"` (hemoglobin subunit alpha)
- **THEN** it returns `ok({ found: true, ... })` with `globalMetricValue`, the four `fractionPlddt*` fields, and the artifact URLs

#### Scenario: A largely disordered protein reports its real mean pLDDT

- **WHEN** the tool is called with `uniprotAccession: "P38398"` (BRCA1)
- **THEN** `globalMetricValue` is 41.59, and the tool description states that a low value reflects genuine disorder, not a failed prediction

#### Scenario: A multi-isoform response is resolved to the queried accession

- **WHEN** AlphaFold answers with more than one entry for the same query — one per UniProt isoform
- **THEN** the tool selects the entry whose own `uniprotAccession` matches the queried accession, and falls back to the first entry when none match exactly

#### Scenario: An accession with no model returns found: false

- **WHEN** AlphaFold answers HTTP 404 for a well-formed accession it holds no model for
- **THEN** the tool returns `ok({ found: false, uniprotAccession })`, not an `is_error` tool result

#### Scenario: An identifier that does not parse returns found: false

- **WHEN** AlphaFold answers HTTP 400 for an identifier that is not a UniProt accession or an AlphaFold DB id
- **THEN** the tool returns `ok({ found: false, uniprotAccession })`, not an `is_error` tool result

#### Scenario: A server error surfaces as an error tool result

- **WHEN** AlphaFold returns a 5xx after retries are exhausted
- **THEN** `execute` throws, and the agent loop records the call as `tool_result { is_error: true }`

### Requirement: describeCall names the queried accession

The tool MUST declare a `describeCall` hook that returns the queried
`uniprotAccession` verbatim, so a caller distinguishes one call from another by
the accession alone.

#### Scenario: describeCall reports the accession

- **WHEN** `describeCall` is invoked with `{ uniprotAccession: "P38398" }`
- **THEN** it returns the string `"P38398"`

### Requirement: The AlphaFold client obeys the absence policy of its provider

`harness/src/tools/lib/alphafold-client.ts` MUST validate the response with a
zod schema over `z.array(...)`, because one query can answer with more than one
isoform entry. Each artifact-link field MUST carry `z.url()`, not `z.string()`.
A comment at the top of the client MUST name the absence policy. AlphaFold DB
omits the key of an absent value. The AlphaMissense annotation URL is present
only for a canonical accession, thus the field carries `.optional()` and not
`.nullable()`.

#### Scenario: A canonical accession carries the AlphaMissense annotation URL

- **WHEN** the queried entry is a canonical UniProt accession
- **THEN** `amAnnotationsUrl` is present

#### Scenario: A non-canonical isoform entry omits the AlphaMissense annotation URL

- **WHEN** the queried entry is a non-canonical isoform
- **THEN** `amAnnotationsUrl` is absent from the parsed record, and it is not `null`

### Requirement: alphafold_prediction is available to the conversation agent only

The tool MUST be wired directly into the conversation agent
(`harness/src/agents/conversation-agent.ts`). It MUST NOT be an entry in the
sandbox tool registry, and `SandboxToolName`
(`harness/src/agents/sandbox/types.ts`) MUST NOT name it. A structural lookup
answers a question of the conversation, thus no sandbox agent reaches for one
yet.

#### Scenario: Conversation agent has the tool

- **WHEN** the conversation agent is created
- **THEN** its tool array includes `alphafoldPredictionTool`

#### Scenario: No sandbox agent can declare the tool

- **WHEN** a sandbox-agent meta names the tool in `meta.tools`
- **THEN** the name is not a `SandboxToolName`, thus the typecheck rejects it
