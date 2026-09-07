/**
 * getStructurePrediction — AlphaFold DB predicted 3-D structure for one
 * UniProt accession.
 *
 * Returns model metadata, confidence, and artifact URLs only — never file
 * contents. A predicted `.pdb` or `.cif` file holds megabytes of coordinates
 * that give the model no benefit in a chat turn; a download of one belongs in
 * the sandbox, where a step can fetch a URL this tool returns.
 */

import { ok, type Result } from "neverthrow";
import { z } from "zod";

import { defineTool, type ToolError } from "../define-tool.js";
import { getStructurePrediction, type AlphaFoldPrediction } from "../lib/alphafold-client.js";

export type GetStructurePredictionOutput = { readonly found: false; readonly uniprotAccession: string } | ({ readonly found: true } & AlphaFoldPrediction);

export const getStructurePredictionTool = defineTool({
    id: "get_structure_prediction",
    description:
        "AlphaFold DB — the predicted 3-D protein structure of EMBL-EBI and DeepMind, keyed by a UniProt accession ('P38398'). Per-residue confidence " +
        "(pLDDT), not experimental certainty: it tells apart a folded domain from a disordered loop, it does not replace a solved structure.\n" +
        "`globalMetricValue` is the mean pLDDT over the whole chain, banded by `fractionPlddt*`: above 90 is very high, 70 to 90 is confident, 50 to 70 " +
        "is low, and below 50 is very low or disordered. A LOW globalMetricValue is not a failed prediction — BRCA1 scores 41.59 because BRCA1 is " +
        "largely disordered, and AlphaFold reports that correctly.\n" +
        "Returns URLs only (`pdbUrl`, `cifUrl`, `paeImageUrl`, `amAnnotationsUrl` — AlphaMissense pathogenicity annotations, present for a canonical " +
        "accession only): fetch one from the sandbox to inspect the coordinates or the annotation table, do not expect the file contents here.\n" +
        "found: false means the accession is not one AlphaFold predicted (not every UniProt entry has a model) — report it and continue, do not retry.",
    inputSchema: z.object({
        uniprotAccession: z.string().min(1).describe("A UniProt accession, for example 'P38398' (BRCA1) or 'P69905' (hemoglobin subunit alpha)."),
    }),
    describeCall: ({ uniprotAccession }) => uniprotAccession,
    execute: async ({ uniprotAccession }): Promise<Result<GetStructurePredictionOutput, ToolError>> => {
        const prediction = await getStructurePrediction(uniprotAccession);
        if (!prediction) return ok({ found: false as const, uniprotAccession });
        return ok({ found: true as const, ...prediction });
    },
});
