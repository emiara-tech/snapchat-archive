# PERFORMANCE-01 design accepted

Foundation authored the [performance contract](../tasks/performance-01.md). Workspace independently reviewed it against original phases 2/4/5 and FILTER's atomic state contract. Root made the distinct corrections; workspace rechecked both findings. This accepts design only.

| Finding | Accepted correction |
| --- | --- |
| P-D1 | The main application snapshot retains the complete immutable committed collection and prepared indexes. One staging worker may terminate without destroying uncached pages or bulk targets. Complete validated transport precedes ready, final authority validation and one FILTER commit. Failed/canceled/busy work preserves current state/history; one pending full-query-only replacement can explicitly supersede query-only preparation. |
| P-D2 | Explicit page/text/row/reference/cache, generation, message-window and assembly limits bound admitted data. Fixed-field whole-record batches use validated acknowledgements. Display truncation cannot alter canonical text, matching or targets. Partial/stale/oversize transport cannot commit, and oversized complete records fail honestly. Finite operation/acknowledgement deadlines and cleanup remain observable. |

Both design review axes have no remaining blocker. Literal lifecycle cases cover uncached C1 pages and complete targets, worker loss around ready/commit, invalid restore, import replacement, busy mutation, explicit query supersession, oversized rows/pages, cumulative transport overflow and stale/partial/duplicate packets.

Before code, accept complete OCC evidence, bind the canonical source-order amendment and freeze FILTER's final preparation/ready/commit interface plus handwritten fixture expectations. QUERY remains the sole matcher. Views and workers cannot apply another sorter or substitute visible pages for the complete collection.

All byte/message ceilings are admission policy pending measurement. Encoded data is not a heap guarantee. The actual 100,000-event raw ZIP, recorded headed physical-desktop procedure and every observed direct control at or below 100 ms remain required. Cold preparation/installation/transport/publication timings are reported separately. No benchmark, runtime integration, full phase or release is accepted.
