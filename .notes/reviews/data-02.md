# DATA-02: Timestamp correction accepted

Scope: the normalization correction against the original [Phase 2](../specs/phase-2.md) and [Phase 3](../specs/phase-3.md) source/time requirements. Author: manager. Independent reviewer: `specs_experience`. The reviewer accepted the frozen correction without editing it.

An export can label an integer as microseconds while recording milliseconds. Normalization preserves a valid microsecond interpretation first. It permits milliseconds only when multiplying the exact integer by 1000 agrees with an explicit zoned source date within that date's recorded precision interval. Numeric magnitude alone cannot establish the unit. Conflicting dates, adjacent seconds and fractional mismatches remain invalid.

Raw values remain intact. Corrected precision, reason and a coverage warning explain the source discrepancy. Normalization version 4 invalidates earlier derived identity while preserving exact submillisecond ordering.

Independent verification: 38 affected checks passed, with source inspection of precision boundaries, offsets, safe integers, raw preservation, query years and coverage. The manager's final build and 42 affected checks passed. An actual private ZIP import produced a populated eligible year profile, bounded approved source references, working cancellation and source-return recovery, with no external archive requests or page errors. Private content and measurements stay outside git.

This closes DATA-02. Full normalization, linking, time-zone and large-archive gates remain open.
