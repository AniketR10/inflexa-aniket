import { expect } from "bun:test";

import { fixtureCase, runFixtureSuite } from "./__fixtures__/fixture-runner.js";
import { UniProtSearchResponseSchema } from "./uniprot-client.js";

runFixtureSuite("UniProtKB search golden fixtures", [
    fixtureCase({
        name: "UniProtSearchResponseSchema (a curated entry, gene_exact + reviewed)",
        provider: "uniprot",
        fixture: "search_BRCA1_reviewed.json",
        drift: "search_BRCA1_reviewed.drift.json",
        schema: UniProtSearchResponseSchema,
        assertOutput: (response) => {
            const row = response.results![0]!;
            expect(row.primaryAccession).toBe("P38398");
            expect(row.uniProtkbId).toBe("BRCA1_HUMAN");
            expect(row.entryType).toContain("reviewed");
            expect(row.sequence?.length).toBe(1863);
            expect(row.proteinDescription?.recommendedName?.fullName?.value).toBe("Breast cancer type 1 susceptibility protein");
            // UniProt splits the locations over more than one comment, thus the
            // mapper collects across every one of them.
            const locationComments = (row.comments ?? []).filter((comment) => comment.commentType === "SUBCELLULAR LOCATION");
            expect(locationComments.length).toBeGreaterThan(1);
        },
    }),
    fixtureCase({
        name: "UniProtSearchResponseSchema (an entry that omits the genes and the comments)",
        provider: "uniprot",
        fixture: "search_Q6ZQY7_sparse.json",
        drift: "search_Q6ZQY7_sparse.drift.json",
        schema: UniProtSearchResponseSchema,
        assertOutput: (response) => {
            const row = response.results![0]!;
            expect(row.primaryAccession).toBe("Q6ZQY7");
            // UniProt omits the key of an absent value, and it never sends null.
            expect(row.genes).toBeUndefined();
            expect(row.comments).toBeUndefined();
        },
    }),
]);
