import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { readFixture } from "../lib/__fixtures__/fixture-runner.js";
import { makeToolContext } from "../__fixtures__/tool-context.js";
import { searchProteinTool } from "./search-protein.js";

const realFetch = globalThis.fetch;

/** Every URL the tool asked for, in call order — the record of the query it built. */
let requestedUrls: string[] = [];

beforeEach(() => {
    requestedUrls = [];
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

function stubResponse(status: number, body: unknown): void {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        requestedUrls.push(String(input));
        return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
}

/** The `query` parameter of the one request the tool made, decoded. */
function sentQuery(): string {
    return new URL(requestedUrls[0]!).searchParams.get("query")!;
}

type SearchProteinInput = Parameters<typeof searchProteinTool.execute>[0];

const DEFAULTS = { organismId: 9606, reviewedOnly: true, limit: 10 } as const;

async function callSearchProtein(input: Partial<SearchProteinInput> & { query: string }) {
    const { ctx } = makeToolContext();
    return (await searchProteinTool.execute({ ...DEFAULTS, ...input }, ctx))._unsafeUnwrap();
}

describe("searchProtein — a resolved symbol", () => {
    it("maps the accession, the name, the length, the function, and the locations", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        const out = await callSearchProtein({ query: "BRCA1" });

        expect(out.proteins).toHaveLength(1);
        const protein = out.proteins[0]!;
        expect(protein.accession).toBe("P38398");
        expect(protein.uniProtkbId).toBe("BRCA1_HUMAN");
        expect(protein.proteinName).toBe("Breast cancer type 1 susceptibility protein");
        expect(protein.geneNames).toEqual(["BRCA1"]);
        expect(protein.sequenceLength).toBe(1863);
        expect(protein.reviewed).toBe(true);
        expect(protein.function).toContain("E3 ubiquitin-protein ligase");
        // The locations are collected across every SUBCELLULAR LOCATION comment,
        // and a location that UniProt repeats is kept once.
        expect(protein.subcellularLocations).toEqual(["Nucleus", "Chromosome", "Cytoplasm"]);
    });

    it("queries gene_exact for a symbol, with the organism and the reviewed filter", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        await callSearchProtein({ query: "BRCA1" });

        expect(sentQuery()).toBe("gene_exact:BRCA1 AND organism_id:9606 AND reviewed:true");
    });

    it("queries accession for an input shaped like one", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        await callSearchProtein({ query: "P38398" });

        expect(sentQuery()).toBe("accession:P38398 AND organism_id:9606 AND reviewed:true");
    });

    it("recognizes the ten-character accession form", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        await callSearchProtein({ query: "A0A0B4J1Y9" });

        expect(sentQuery()).toContain("accession:A0A0B4J1Y9");
    });

    it("drops the organism clause when organismId is null", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        await callSearchProtein({ query: "BRCA1", organismId: null });

        expect(sentQuery()).toBe("gene_exact:BRCA1 AND reviewed:true");
    });

    it("drops the reviewed clause when reviewedOnly is false", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        await callSearchProtein({ query: "BRCA1", reviewedOnly: false });

        expect(sentQuery()).toBe("gene_exact:BRCA1 AND organism_id:9606");
    });
});

describe("searchProtein — an entry that omits the optional keys", () => {
    it("maps the absent genes and comments to empty values, not to an error", async () => {
        stubResponse(200, readFixture("uniprot", "search_Q6ZQY7_sparse.json"));

        const out = await callSearchProtein({ query: "Q6ZQY7" });

        const protein = out.proteins[0]!;
        expect(protein.accession).toBe("Q6ZQY7");
        expect(protein.geneNames).toEqual([]);
        expect(protein.function).toBeNull();
        expect(protein.subcellularLocations).toEqual([]);
    });
});

describe("searchProtein — no match", () => {
    // UniProt answers an unknown query with HTTP 200 and an empty array, never
    // a 404, thus the empty case has no status-code branch at all.
    it("returns an empty proteins array, not an is_error", async () => {
        stubResponse(200, { results: [] });

        const out = await callSearchProtein({ query: "NOTAGENE123" });

        expect(out).toEqual({ proteins: [], hasMore: false });
    });
});

describe("searchProtein — the bound on the answer", () => {
    it("trims to the limit and reports that more rows existed", async () => {
        const row = (readFixture("uniprot", "search_BRCA1_reviewed.json") as { results: unknown[] }).results[0]!;
        // The client asks for `limit + 1` rows, thus three rows for a limit of 2
        // is what "UniProt held more" looks like on the wire.
        stubResponse(200, { results: [row, row, row] });

        const out = await callSearchProtein({ query: "BRCA1", reviewedOnly: false, limit: 2 });

        expect(out.proteins).toHaveLength(2);
        expect(out.hasMore).toBe(true);
        expect(new URL(requestedUrls[0]!).searchParams.get("size")).toBe("3");
    });

    it("reports hasMore false when the answer fits inside the limit", async () => {
        stubResponse(200, readFixture("uniprot", "search_BRCA1_reviewed.json"));

        const out = await callSearchProtein({ query: "BRCA1", limit: 2 });

        expect(out.hasMore).toBe(false);
    });
});

describe("searchProtein — an upstream failure", () => {
    it("throws on a 5xx", async () => {
        stubResponse(500, "upstream down");

        const { ctx } = makeToolContext();
        await expect(searchProteinTool.execute({ ...DEFAULTS, query: "BRCA1" }, ctx)).rejects.toThrow();
    });
});

describe("searchProtein — describeCall", () => {
    it("names the query", () => {
        expect(searchProteinTool.describeCall!({ ...DEFAULTS, query: "BRCA1" })).toBe("BRCA1");
    });
});
