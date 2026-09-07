import { afterEach, describe, expect, it } from "bun:test";

import { readFixture } from "../lib/__fixtures__/fixture-runner.js";
import { makeToolContext } from "../__fixtures__/tool-context.js";
import { getStructurePredictionTool } from "./get-structure-prediction.js";

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
});

function stubResponse(status: number, body: unknown): void {
    globalThis.fetch = (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("getStructurePrediction — a known accession", () => {
    it("returns the model metadata, confidence, and artifact URLs", async () => {
        stubResponse(200, readFixture("alphafold", "prediction-P69905.json"));

        const { ctx } = makeToolContext();
        const out = (await getStructurePredictionTool.execute({ uniprotAccession: "P69905" }, ctx))._unsafeUnwrap();

        expect(out).toEqual({
            found: true,
            uniprotAccession: "P69905",
            uniprotDescription: "Hemoglobin subunit alpha",
            latestVersion: 6,
            modelCreatedDate: "2025-08-01T00:00:00Z",
            globalMetricValue: 98.06,
            fractionPlddtVeryLow: 0.0,
            fractionPlddtLow: 0.007,
            fractionPlddtConfident: 0.0,
            fractionPlddtVeryHigh: 0.993,
            pdbUrl: "https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.pdb",
            cifUrl: "https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif",
            paeImageUrl: "https://alphafold.ebi.ac.uk/files/AF-P69905-F1-predicted_aligned_error_v6.png",
            amAnnotationsUrl: "https://alphafold.ebi.ac.uk/files/AF-P69905-F1-aa-substitutions.csv",
        });
    });

    it("selects the entry matching the queried accession out of a multi-isoform response", async () => {
        stubResponse(200, readFixture("alphafold", "prediction-P38398.json"));

        const { ctx } = makeToolContext();
        const out = (await getStructurePredictionTool.execute({ uniprotAccession: "P38398" }, ctx))._unsafeUnwrap();

        expect(out.found).toBe(true);
        if (out.found) {
            expect(out.uniprotAccession).toBe("P38398");
            expect(out.globalMetricValue).toBe(41.59);
            // A largely-disordered protein still reports its real mean pLDDT.
            expect(out.fractionPlddtVeryLow).toBeGreaterThan(out.fractionPlddtVeryHigh);
        }
    });

    it("selects the isoform entry when the queried accession names one", async () => {
        stubResponse(200, readFixture("alphafold", "prediction-P38398.json"));

        const { ctx } = makeToolContext();
        const out = (await getStructurePredictionTool.execute({ uniprotAccession: "P38398-8" }, ctx))._unsafeUnwrap();

        expect(out.found).toBe(true);
        if (out.found) {
            expect(out.uniprotAccession).toBe("P38398-8");
            // The isoform entry carries no AlphaMissense annotation link.
            expect(out.amAnnotationsUrl).toBeUndefined();
        }
    });
});

describe("getStructurePrediction — an accession AlphaFold does not recognize", () => {
    it("returns found: false on a 400, not an is_error", async () => {
        stubResponse(400, { error: "Invalid identifier format. Please use a UniProt accession or a supported AlphaFold DB ID." });

        const { ctx } = makeToolContext();
        const out = (await getStructurePredictionTool.execute({ uniprotAccession: "NOTANACC" }, ctx))._unsafeUnwrap();

        expect(out).toEqual({ found: false, uniprotAccession: "NOTANACC" });
    });
});

describe("getStructurePrediction — an upstream failure", () => {
    it("throws on a 5xx", async () => {
        stubResponse(500, "upstream down");

        const { ctx } = makeToolContext();
        await expect(getStructurePredictionTool.execute({ uniprotAccession: "P38398" }, ctx)).rejects.toThrow();
    });
});

describe("getStructurePrediction — describeCall", () => {
    it("names the queried accession", () => {
        expect(getStructurePredictionTool.describeCall!({ uniprotAccession: "P38398" })).toBe("P38398");
    });
});
