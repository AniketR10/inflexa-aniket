/**
 * Pure async client functions for the AlphaFold Protein Structure Database
 * (AlphaFold DB) prediction API. Keyless and public: one unauthenticated GET,
 * keyed by a UniProt accession.
 *
 * Absence policy: AlphaFold DB omits the key of an absent value — the
 * AlphaMissense annotation URLs (`amAnnotationsUrl` and its two genome-build
 * siblings) are present only for a canonical UniProt accession, and absent
 * from an isoform entry — thus a maybe-absent field carries `.optional()`,
 * not `.nullable()`.
 *
 * Not-found semantics: AlphaFold splits absence over two status codes. An
 * identifier that does not parse as a UniProt accession or an AlphaFold DB id
 * gives 400 with an `Invalid identifier format` body. A well-formed accession
 * that AlphaFold holds no model for gives 404 with an empty object. Both are
 * the same outcome for a caller, and `isUnexpectedApiError` classifies each
 * `http_status` in the 4xx range as expected, thus one branch answers both.
 */

import { z } from "zod";

import { apiFetchValidated, describeApiError, isUnexpectedApiError } from "./api-utils.js";

const ALPHAFOLD_BASE = "https://alphafold.ebi.ac.uk/api/prediction";

/**
 * One entry of the AlphaFold DB prediction array. A query by a canonical
 * accession can answer with more than one entry — one per UniProt isoform —
 * thus the schema is `z.array(...)` and the client selects the entry that
 * matches the queried accession.
 */
export const AlphaFoldPredictionSchema = z.object({
    uniprotAccession: z.string(),
    uniprotDescription: z.string(),
    latestVersion: z.number(),
    modelCreatedDate: z.string(),
    globalMetricValue: z.number(),
    fractionPlddtVeryLow: z.number(),
    fractionPlddtLow: z.number(),
    fractionPlddtConfident: z.number(),
    fractionPlddtVeryHigh: z.number(),
    pdbUrl: z.url(),
    cifUrl: z.url(),
    paeImageUrl: z.url(),
    amAnnotationsUrl: z.url().optional(),
});

export type AlphaFoldPrediction = z.infer<typeof AlphaFoldPredictionSchema>;

/**
 * Fetch the AlphaFold structure prediction for one UniProt accession.
 *
 * Gives `null` when AlphaFold holds no model for the accession, and `null` for
 * an identifier it cannot parse. When the array holds more than one entry —
 * the isoforms of one canonical accession — the entry whose own
 * `uniprotAccession` matches the queried accession wins. A query that names no
 * exact isoform falls back to the first entry, which AlphaFold orders
 * canonical-first.
 */
export async function fetchAlphaFoldPrediction(uniprotAccession: string): Promise<AlphaFoldPrediction | null> {
    const accession = uniprotAccession.trim();
    const res = await apiFetchValidated(`${ALPHAFOLD_BASE}/${encodeURIComponent(accession)}`, z.array(AlphaFoldPredictionSchema));

    if (res.isErr()) {
        if (isUnexpectedApiError(res.error)) throw new Error(describeApiError(res.error));
        return null;
    }

    const entries = res.value;
    if (entries.length === 0) return null;

    const exact = entries.find((entry) => entry.uniprotAccession.toUpperCase() === accession.toUpperCase());
    return exact ?? entries[0]!;
}
