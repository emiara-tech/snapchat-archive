# ORDERING-01 design accepted

Experience authored the [canonical source-order amendment](../tasks/ordering-01.md). Foundation independently reviewed it against [Phase 4](../specs/phase-4.md), accepted QUERY-01 behavior, source-identity authority and exclusion/privacy rules. Root made the distinct correction; foundation rechecked it. This accepts design only.

| Finding | Accepted correction |
| --- | --- |
| ORD-S1 | The literal excluded-row case explicitly requests all review statuses with `reviews: []`. It expects the pair in matched and the permitted singleton in effective. Omitted active reviews expect the singleton in both. Query defaults are preserved. |

Both design review axes have no remaining blocker. Exact instants retain chronology; equal instants and unavailable-instant rows use one total logical-document/numeric-position/reference order. Date-only evidence retains its recorded date. Copy provenance cannot move unchanged logical rows. Unrelated undated documents receive deterministic presentation without invented chronology.

Before code, accept OCC's exact typed document/row/reference facts and freeze supported multi-container traversal. Bind the minimum ordering/calculation capability through results, portable state, async stamps, indexes and cursors. No parser, page/worker sorter or global version rewrite is authorized by this design.

Implementation, actual raw-import ordering checks, full conversation/filter parity and the 100,000-event/100 ms desktop gate remain open. Pure QUERY-01 acceptance is unchanged until the reviewed amendment is implemented.
