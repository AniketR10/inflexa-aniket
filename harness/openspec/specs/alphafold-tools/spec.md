# alphafold-tools Specification

## Purpose

Defines the harness tool `get_structure_prediction`, which wraps the AlphaFold
Protein Structure Database (AlphaFold DB) prediction API
(`https://alphafold.ebi.ac.uk/api/prediction`) of EMBL-EBI and DeepMind. Before
this tool the harness had no structural biology tool, thus an agent could not
tell a folded domain from a disordered loop. AlphaFold DB is keyless and
public, and it answers one unauthenticated GET, keyed by a UniProt accession.

The tool follows the harness tool-error contract literally. AlphaFold answers
HTTP 400, not 404, for an accession it does not recognize. `isUnexpectedApiError`
treats each 4xx as expected. Thus a 400 becomes `ok({ found: false,
uniprotAccession })`, not a thrown error. An unexpected failure throws out of
`execute` instead — a 5xx, a timeout, retry exhaustion, or a schema mismatch.
The agent loop then wraps it as a `tool_result { is_error: true }`.

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

The system MUST give a `getStructurePredictionTool` (on-wire id
`get_structure_prediction`, built with `defineTool`) that takes a required
`uniprotAccession` string. For a recognized accession it MUST return
`ok({ found: true, uniprotAccession, uniprotDescription, latestVersion,
modelCreatedDate, globalMetricValue, fractionPlddtVeryLow, fractionPlddtLow,
fractionPlddtConfident, fractionPlddtVeryHigh, pdbUrl, cifUrl, paeImageUrl,
amAnnotationsUrl? })`. For an accession AlphaFold does not recognize it MUST
return `ok({ found: false, uniprotAccession })`.

#### Scenario: A canonical accession returns its model

- **WHEN** the tool is called with `uniprotAccession: "P69905"` (hemoglobin subunit alpha)
- **THEN** it returns `ok({ found: true, ... })` with `globalMetricValue`, the four `fractionPlddt*` fields, and the artifact URLs

#### Scenario: A largely disordered protein reports its real mean pLDDT

- **WHEN** the tool is called with `uniprotAccession: "P38398"` (BRCA1)
- **THEN** `globalMetricValue` is 41.59, and the tool description states that a low value reflects genuine disorder, not a failed prediction

#### Scenario: A multi-isoform response is resolved to the queried accession

- **WHEN** AlphaFold answers with more than one entry for the same query — one per UniProt isoform
- **THEN** the tool selects the entry whose own `uniprotAccession` matches the queried accession, and falls back to the first entry when none match exactly

#### Scenario: An unrecognized accession returns found: false

- **WHEN** AlphaFold answers HTTP 400 for an accession it does not recognize
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
isoform entry. A comment at the top of the client MUST name the absence
policy. AlphaFold DB omits the key of an absent value. The AlphaMissense
annotation URL is present only for a canonical accession. Thus the field
carries `.optional()`, not `.nullable()`.

#### Scenario: A canonical accession carries the AlphaMissense annotation URL

- **WHEN** the queried entry is a canonical UniProt accession
- **THEN** `amAnnotationsUrl` is present

#### Scenario: A non-canonical isoform entry omits the AlphaMissense annotation URL

- **WHEN** the queried entry is a non-canonical isoform
- **THEN** `amAnnotationsUrl` is absent from the parsed record, and it is not `null`

### Requirement: get_structure_prediction is available via the per-agent allowlist and the conversation agent

The tool MUST be an entry in the central sandbox tool registry.
`resolveSandboxTools` (`harness/src/agents/sandbox/shared.ts`) resolves it under
the `SandboxToolName` value `getStructurePrediction`. This reaches a sandbox
agent only when its `meta.tools` allowlist names it. The tool MUST also be
wired directly into the conversation agent
(`harness/src/agents/conversation-agent.ts`).

#### Scenario: Sandbox agent resolves the tool from its allowlist

- **WHEN** a sandbox-agent meta lists `"getStructurePrediction"` in `meta.tools`
- **THEN** `createSandboxAgent` resolves it with `resolveSandboxTools` and adds it to that agent's tool array

#### Scenario: Conversation agent has the tool

- **WHEN** the conversation agent is created
- **THEN** its tool array includes `getStructurePredictionTool`
