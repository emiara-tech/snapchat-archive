# OCCURRENCE-01 stage 2 accepted binding

Accepted exact binding after workspace author, foundation independent original-spec/standards review, root distinct OCC2-B1/B2 correction and foundation recheck. The accepted stage-1 code baseline is `d88c7b2`. Binding sources are [the producer contract](occurrence-01.md), [QUERY-01](query-01.md), frozen query types/code, [ORDERING-01](ordering-01.md), [the stage-2 literal oracle](occurrence-01-stage-2-oracle.md) and [the general preflight](../reviews/occurrence-01-stage-2-design.md). [The binding review](../reviews/occurrence-01-stage-2-binding.md) records acceptance. This freezes staged types and finite admission policy. It accepts no implementation, production performance measurement or full phase.

Workspace owns the serial code-author handoff after root records this binding. Foundation independently reviews the frozen implementation; experience remains the distinct code fixer for valid findings. Root inspects the actual product journey. No private input, provider request or external service was used for binding acceptance.

## One staged fact population

Add optional fields to `ArchiveDataset` for compatibility with existing handwritten constructors. Both production seams always publish them explicitly:

```ts
occurrenceFacts?: DatasetOccurrenceFacts | null;
occurrenceFactsUnavailableReason?: 'missing-document-proof' | null;
```

`DatasetOccurrenceFacts` is one readonly staged subset of accepted DTOs. It is not QueryEvidence, has no `occurrencesComplete` flag and cannot be cast or substituted for QueryEvidence. Its nonnull value means the producer retained supported row/reference facts with actual document proof, including explicit uninterpreted remainders. It does not claim that an unreadable section's history is known.

```ts
interface DatasetOccurrenceFacts {
  readonly occurrenceVersion: 1;
  readonly sources: readonly QuerySource[];
  readonly resources: readonly QueryMediaRecord[];
  readonly occurrences: readonly DatasetOccurrenceFact[];
  readonly eventRows: readonly DatasetEventRowFact[];
  readonly referenceDiagnostics: readonly DatasetReferenceDiagnostic[];
}

interface RecordedRowPosition {
  readonly containerPointer: string;
  readonly rowIndex: number;
}

type ReferenceParserRule = 'array-v1' | 'json-array-string-v1' | 'delimited-v1';
type ReferenceInterpretation =
  | {
      readonly state: 'absent' | 'unsupported';
      readonly parserRule: null;
      readonly sourcePositions: null;
      readonly knownSupportedSlots: 0;
      readonly unknownRemainder: true;
    }
  | {
      readonly state: 'supported';
      readonly parserRule: ReferenceParserRule;
      readonly sourcePositions: number;
      readonly knownSupportedSlots: number;
      readonly unknownRemainder: boolean;
    };

interface DatasetEventRowFact {
  readonly eventId: string;
  readonly origin: 'chats' | 'snaps';
  readonly identity: Omit<QueryOccurrence['identity'], 'referenceOrdinal'>;
  readonly recordedPosition: RecordedRowPosition;
  readonly references: ReferenceInterpretation;
}

type DatasetOccurrenceFact = Omit<QueryOccurrence, 'time'> & {
  readonly normalizedTime: NormalizedTime;
  readonly recordedPosition: RecordedRowPosition;
  readonly rawMediaType: string | null;
  readonly reference: {
    readonly referenceId: string | null;
    readonly parserRule: ReferenceParserRule | 'memory-mid-v1';
    readonly matchingRule: 'chat-exact-v1' | 'memory-date-mid-main-v1';
    readonly fieldPointer: string;
    readonly token: string;
  } | null;
};

type DatasetReferenceDiagnostic = Omit<QueryDiagnostic, 'code'> & {
  readonly code:
    | 'absent-reference-field' | 'unsupported-reference-field'
    | 'malformed-reference-position' | 'unknown-occurrence-kind'
    | 'unresolved-memory-reference' | 'reference-target-is-layer'
    | 'unsupported-memory-row' | 'unsupported-occurrence-field';
  readonly fieldPointer: string | null;
  readonly referenceOrdinal: number | null;
};
```

These concrete types belong in `src/types/dataset.ts`, importing the existing Query types. No changes to `archiveQuery.ts` or its validator are authorized. NormalizedTime remains the actual current type and interpretation; no guessed QueryTime, fake sourceTimeId, padded-orderKey parser or earlier date conversion enters this stage.

The single `sources` registry owns every staged source ID. Occurrences and eventRows retain exact logical row-copy source IDs. Resource proof, candidate proof and diagnostic proof reference that same registry. Resource and occurrence arrays are immutable producer output; an owner decision does not mutate them.

If any supplied JSON document lacks the complete, validated original SHA/actual-length/exact-ordinal proof, the entire staged envelope is null with `missing-document-proof`. Legacy events/assets/source inspection remain available. Do not publish an empty envelope to hide unsupported attestation. An attested empty section can produce an empty known population; an attested unreadable document retains its exact existing diagnostic and does not fabricate rows. A physical-only archive with no documents can publish its available physical resources and zero known historical rows. The complete `queryEvidence` is always null and its reason is always `producer-incomplete`, including completely attested stage-2 inputs.

## Source position and proof ownership

Capture event rows and Memories rows in the existing original-row pass before sanitizing, skipping or grouping. `containerPointer` is the actual escaped array container and `rowIndex` is the original nonnegative array index. For `fixture/a~b`, use `/fixture~1a~0b`; the row pointers for positions 2 and 10 are `/fixture~1a~0b/2` and `/fixture~1a~0b/10`. Memories uses `/Saved Media` and its actual row index. Event occurrences use their exact parent's recorded position. Genuine row repeats and invalid rows do not compact positions.

The original document SHA/path, exact row pointer, original row repeat rank and copy membership stay in the accepted identity shape. Occurrences additionally use the original reference ordinal. Capture the original repeat rank before redaction. Do not derive row identity from event.raw, asset.raw, document text re-encoding or the first runtime source handle. Positions remain presentation facts outside identity hashing.

No document-wide container ordinal is supplied. Object.keys/Object.entries enumeration does not prove original JSON member order. Future ORDERING compares the supported numeric within-container position and freezes an explicit deterministic cross-container presentation policy, with its chronology limitation. This stage adds no sorter or ordering activation.

Register QuerySource IDs from immutable source fingerprint, exact safe path, physical entry ordinal and record pointer. Available resource sources have an empty physical-file pointer and `documentSha256: null`. Row sources have their exact original SHA and row pointer. Occurrence `sourceIds` and `identity.copySourceIds` are the same row-copy set, as required by QUERY validation. Supplementary slot inspection is not appended to that set.

`reference.fieldPointer` identifies the real own Media IDs field, or the own Download Link field for an extracted Memories mid. An actual array slot is inspected through that field and the accepted identity referenceOrdinal. Encoded strings have no fabricated nested `/Media IDs/2` JSON pointer. Malformed-position diagnostics use the actual row proof, the real field pointer and original ordinal. Unowned invalid-row diagnostics remain review-only in later canonical projection.

An absent-field diagnostic has fieldPointer null. Its source points to the actual owning row, not a nonexistent child property. An unsupported existing field uses its exact field pointer and referenceOrdinal null. Invalid individual array/token positions use their original ordinal. Diagnostic IDs and copy sources follow the same original row/slot partition, with fixed codes and no token/value embedded in an error message.

## Parser, declaration and resolution rules

An own Media IDs array uses `array-v1`. Each original position is inspected once. A supported nonempty string token creates one occurrence; malformed/nonstring/unsafe positions create diagnostics and an unknown remainder, with no guessed occurrence. `["A",null,"A"]` therefore creates ordinals 0 and 2, two known supported slots, three source positions and unknownRemainder true. Corresponding copied rows add provenance only.

A string whose trimmed first character is `[` is a `json-array-string-v1` candidate. Admit its encoded length before native JSON.parse. A valid array then obeys the same original-position rules. A failed parse or other resulting shape is an unsupported whole field; it never becomes a safe-looking bracket token through delimiter fallback. Remaining strings use the current ordered whitespace/comma/semicolon delimiter rule, `delimited-v1`, scanned incrementally without split/filter/materializing an unlimited token array. Consecutive delimiters do not invent empty slots. An empty array or supported empty/whitespace-only string has known zero positions and unknownRemainder false. An absent field, null, object or other unsupported whole value has no attested slot total and unknownRemainder true. An event kind alone never creates an attachment.

Safe tokens keep the current trim and local path validation and reject `?`, `#`, `&`, `<` and `>`. URLs, traversal and schemes cannot match by substring or trigger a fetch. Array tokens retain supported internal filename spaces. Delimited strings preserve only their established token semantics. Do not add aliases or a generic parser/rule framework.

## Staged field domains and unsupported values

Every string placed in an accepted Query DTO subset must be a well-formed Unicode scalar string. Paired non-BMP characters remain supported; a lone high or low surrogate is inadmissible. Byte admission does not replace the frozen DTO domain. Nonempty entity/source/proof IDs and actual `QuerySource.sourceId` obey the accepted 256-code-point ceiling. Resource entry source handles obey the same domain. Source paths, record pointers, identity document paths/row pointers and resource filenames obey the accepted 4096-code-point ceiling as well as their stated byte admission. Physical entries still require the current safe local-path rules. New field/container pointers and stored safe tokens also require well-formed scalar strings and their stated byte ceilings. Check these fields directly with narrow private helpers, without coercion, accessor execution, a generic schema framework or a whole-query validator.

An inadmissible required actual ID, source handle, path or row/container/field locator rejects the entire preparation with one fixed safe error before registering or appending its facts. Do not silently omit supported rows, repair a surrogate into a different pointer, truncate a locator or return null under the unrelated `missing-document-proof` reason. The loader keeps its reader and original files available; the caller's previously owned snapshot is untouched. Complete query capability remains null for its stated producer-incomplete reason.

An inadmissible reference token is instead a malformed original slot. Keep its valid owning row proof, real field pointer and original ordinal diagnostic, with no occurrence/missing resource and with unknown remainder. Do not promote a replacement-character token into an exact match.

Nullable metadata has a separate explicit uncertainty policy. An own nonstring or inadmissible-scalar Location/declaration literal produces null for that nullable staged value, not a repaired string. It emits one `unsupported-occurrence-field` diagnostic per logical owning row and field, attributed to that real own field and row-copy sources. A chat row diagnostic owns its event; a Saved Media diagnostic owns its retained Memory occurrence. Its referenceOrdinal is null. A malformed declaration leaves declaredKind unknown. A recognized Memory row remains one save even when this is its only recognized own field. The original local byte evidence stays inspectable. Existing absent/empty/redacted values retain their established null interpretation without invented field values. Oversized admitted metadata remains a resource-limit failure rather than a silently truncated/null success. `NormalizedTime.raw` remains the actual bounded uninterpreted domain value; this stage neither turns it into QueryTime nor claims it is an accepted Query string field.

`chat-exact-v1` means exact equality with a current supported local media ID, safe full path or filename stem. Build one index from available physical originals. Layers and unavailable metadata are excluded before candidate selection. A unique original produces export-exact proof. Multiple originals stay ambiguous, with separate candidate-specific physical sources plus permitted row evidence. No temporal/title/name/similarity inference or English basis-string parsing. A layer-only exact reference is unlinked with missingMediaId null and a typed diagnostic. It does not invent an absent original. A safe explicit missing original token may establish an unavailable metadata record.

For all occurrence kinds, `rawMediaType` comes from the original own Media Type string, with current credential/remote-URL redaction respected. Preserve an ordinary supported/unknown literal, or null for absent/nonstring/redacted values. Declared IMAGE/VIDEO/AUDIO/STICKER/GIF/ATTACHMENT kinds may be supplied by their established row rule. TEXT declares the event's text kind, not a referenced file's kind, so a reference in a TEXT row has occurrence declaredKind unknown. Absent/unknown values also stay unknown. A resolved physical JPEG/video keeps its physical resource kind and cannot repair that declaration. A mixed reference list uses the row's supported declaration; no per-file type inference enters the occurrence.

A recognized Saved Media row has at least one own Date, Media Type, Download Link or Location field. Empty/unknown-only objects are diagnostics without a save. Every recognized row creates one Memories occurrence, referenceOrdinal 0, owningEventId null, even if its date/kind/reference is uninterpretable. Genuine repeated rows remain saves; exact document copies are provenance only. Capture each row's actual NormalizedTime, declaration and supported Location before updating compatibility assets. Caption is always null because no established caption field format is supported. Chat Content, Message and Caption aliases do not establish occurrence captions.

`memory-mid-v1` extracts only a safe mid from the own Download Link, without retaining/fetching its URL. `memory-date-mid-main-v1` matches only the established literal date-prefix/mid main filename. Own IMAGE gives `.jpg`, own VIDEO gives `.mp4`; TEXT/unknown/other kinds cannot select an invented `.unsupported` extension or borrow the physical candidate's extension. The currently supported yyyy-mm-dd prefix is a filename witness, not proof of a valid instant. Invalid recorded time remains invalid even if that exact filename exists. Without supported kind/date/mid, keep the recognized save unresolved and its limitations. A same-mid file elsewhere never repairs the missing date-specific path. `reference` is null where no supported mid can be extracted.

Location is only the recognized Memories row's own established nonempty string, subject to the current sensitive metadata redaction. Event occurrences keep location null. It never comes from accumulated asset metadata or a different row. Source inspection retains the original evidence.

## Minimal resources and compatibility

Resources use the actual accepted QueryMediaRecord shape. Available records derive only from exact non-directory physical entries: stable existing physical ID, safe filename/path, physical kind, exact entry, original/layer role and physical-only sources. Preserve each duplicate entry/ordinal and original bytes. Existing layer inventory classification can populate layerState, but this stage neither derives nor activates support relationships.

Missing records have available false, entry null, role original and kind unknown. Their filename is a supported minimal token or expected path; it never copies a row's caption/location/time or first/last claimed kind. They cite the actual declaring row sources. A shared established missing target accumulates only its declaring proof; later QUERY projects the intersection with selected occurrence sources, already implemented by the frozen selector. No physical bytes, digest or entry is invented.

The occurrence association references this exact resources/sources population. Existing event.mediaReferenceIds, MediaLinks, assetIds and legacy aggregated assets are compatibility projections of the same parsed slots and resolution pass. Keep their existing shapes and conservative store behavior usable. They do not run a second matcher or authorize full canonical filters. `ConversationEvent.mediaReferenceIds` continues to contain actual token strings, including repeated supported slots; `MediaLink.referenceId` carries the per-slot opaque identity. Do not repurpose the token array to opaque IDs.

Every distinct source/path/ordinal physical entry remains a separate resource/asset ID even when its bytes, name, size or CRC equal another entry. No content-based physical deduplication is permitted. Confirmed event.assetIds may remove repeated memberships of the same physical ID only. Several historical slots/links referring to that one physical ID remain distinct. Two exact candidate entries with identical bytes remain ambiguous.

Preserve valid singleton legacy reference/link IDs under full dataset/item/evidence authority. For a repeated token partition, every split reference receives a versioned identity and corresponding corrected links; no arbitrary slot retains the old conflated ID. The new occurrence ID uses the accepted occurrence-v1 logical identity. Missing target identities preserve a valid singleton where it denotes the same supported target; shared/colliding legacy metadata identities require one corrected minimal target identity without choosing a first row. This cannot migrate old choices or make a bare ID authoritative.

## Finite admission proposal

Numbers below are accepted stage-2 admission policy pending actual producer enforcement and measurement. They bound stage-2 parsing and expanded output, not browser heap, native decoder allocations or hardware performance. A count and encoded-size guard rejects the whole operation before publishing any dataset/facts. No partial envelope, silently trimmed candidate list, successful empty result or persisted decision mutation is permitted. The current archive session/original files remain available for retry with a supported selection. A previously committed dataset remains the application owner's usable snapshot.

| Limit field in OccurrencePreparationLimits | Proposed ceiling | Guard ownership |
| --- | --- | --- |
| maxDocumentBytes | 128 MiB | Existing maximum exact entry read; actual loader bytes and normalizer document proof/text preflight |
| maxDocumentsEncodedBytes | 256 MiB | Aggregate original documents before loading/parsing; check actual bytes as read, conservative UTF-8 text count for unverified DTOs |
| maxEventRows | 250,000 | Logical supported eventRows, with original positions/proof; physical copies add source counts |
| maxOccurrences | 250,000 | Supported chat/snap slots plus recognized Memories rows |
| maxResources | 250,000 | Physical inventory and established missing metadata |
| maxSources | 500,000 | Sole registry entries including row copies/physical/diagnostic sources |
| maxDiagnostics | 250,000 | Expanded reference/row diagnostics, before appending |
| maxReferencePositionsPerRow | 4,096 | All inspected list positions, including malformed positions, before array iteration/JSON-array processing |
| maxReferencePositions | 500,000 | Operation-wide inspected positions across original/copy rows; prevents invalid/copy-token work evading occurrence counts |
| maxCandidatesPerOccurrence | 64 | Available exact originals; reject before copying a larger indexed candidate pool |
| maxAssociationTargets | 500,000 | Confirmed targets, missing targets and candidate members across occurrence facts and compatibility links |
| maxSourceIdsPerFact | 128 | Each row-copy, proof, resource or diagnostic source array; reject before extending |
| maxReferenceFieldBytes | 1 MiB | Encoded own list field or Download Link before parsing/scanning |
| maxReferenceFieldsBytes | 64 MiB | Aggregate encoded inspected reference fields including copy inputs |
| maxTokenBytes | 4 KiB | Each safe token before storing/indexing; do not truncate |
| maxLocatorBytes | 4 KiB | Each added source handle, path, field/row/container pointer before storing; accepted scalar/code-point domains apply independently |
| maxLiteralBytes | 16 KiB | Each added location/declaration/time companion value; no copying a huge unknown raw time tree |
| maxFactBytes | 256 KiB | One complete staged occurrence/row/resource/source/diagnostic, before appending |
| maxFactsBytes | 256 MiB | Aggregate exact UTF-8 JSON-equivalent size of the envelope, with fixed framing included |

Encoded means exact UTF-8 JSON serialization size for structured fields/facts and UTF-8 bytes for original text/token values. Include escape expansion, separators, arrays, nullable values and object keys. Count before materializing unbounded intermediate arrays/strings. A private incremental byte counter may short-circuit at the limit; do not stringify the whole input/envelope to discover it is too large. Existing document JSON.parse remains admitted by document limits; this does not claim that native parsing can be interrupted. The new parser checks explicit array length before iteration. Bounded encoded-array JSON parsing has a field-byte ceiling and checks its resulting array length before further maps/copies. Delimited input scans ordinal positions without split. Guard candidate counts before target/proof arrays and links expand.

The maxFactsBytes charge is the complete staged envelope plus the expanded compatibility reference/link arrays and new missing metadata records, including each repeated link's duplicated proof. maxAssociationTargets counts target entries in both the staged associations and compatibility links. Existing unrelated text/event/asset payloads remain under document admission, rather than becoming a claimed total-heap budget. No excluded structure is silently retained as an uncharged staging copy.

Admit each new resource before constructing its compatibility MediaAsset, source registry entry or reference-index expansion. Admit candidate/association targets before creating proof arrays and compatibility links. Apply these guards even when missing document proof keeps occurrenceFacts null. A check after an oversized compatible population has already been built does not satisfy this policy.

The existing two public behavior seams remain. Add `DatasetInput.occurrenceLimits?: Partial<OccurrencePreparationLimits>` and an optional third `loadArchiveDataset(session, signal?, limits?)` argument with the same shape. A test/local caller may lower known limits only. Missing fields use production defaults; every supplied value must be a positive safe integer no greater than its default. Reject unknown keys, non-data values or malformed overrides with one fixed safe error before any read/work. No callback, generic budget engine, plugin or runtime raising knob. The loader resolves limits once and passes them with the existing worker input; no worker/read-operation protocol extension is introduced.

Budget failure uses a fixed message such as "The archive exceeds the supported occurrence preparation limits. Select fewer ZIP parts and retry." It may name a fixed public limit code, never a source path, unknown property, token, row, URL or credential. The loader must not dispose the reader on a preparation-budget failure. A subsequent public call with valid limits/original selection must remain usable.

## Literal tests and measurements before implementation acceptance

The [accepted C1–C13 oracle](occurrence-01-stage-2-oracle.md) remains binding. Add the following independent cases through loadArchiveDataset/normalizeArchiveDataset, not private parsers:

1. Lower maxOccurrences to 2. Authored `["A","A","B"]` fails with a fixed safe error and no returned partial dataset. Raise only back to approved default in a new call; the same actual reader returns all three slots and both original byte streams.
2. Lower maxReferencePositionsPerRow to 2. `["A",null,"A"]` rejects instead of dropping the original position 2. Under the default, it returns ordinals 0/2 plus the original-position-1 diagnostic and unknown remainder.
3. Lower maxSources to the exact authored baseline source count. The count fits exactly; one actual copy/source beyond it rejects without discarding reader ownership or pretending logical duplicates removed provenance.
4. Lower maxCandidatesPerOccurrence to 1. Two exact physical originals stay a whole-operation failure, never a first candidate or confirmed match. At default, the same source has two candidate-specific proofs and no other candidate's source canary.
5. Lower reference-field, token, literal, per-fact and aggregate encoded ceilings with ASCII, multibyte and JSON-escape literals. Assert exact fits and one-byte overflow; no truncated token/location/copy list. Unknown limit names and credential canaries are absent from errors.
6. A supported TEXT row referencing an actual JPEG retains event kind text, occurrence declaration unknown and resource kind image. Unknown Media Type cannot acquire a known kind from bytes. A supported IMAGE row with no reference retains its event, zero attested reference slots and unknown remainder; an own supported empty list states known zero.
7. A missing safe token and two recognized Memory rows for the same established missing target retain occurrence-specific time/location and a minimal shared unknown-kind resource. Its source set is the declaring row set; no first-row caption/location/time becomes intrinsic. Layer-only references create no missing original.
8. At least 100,000 sparse text events must fit the proposed source/event/count/output policy. Run a synthetic encoded-size measurement of those actual proposed DTOs and a bounded repeated-reference fixture before author acceptance. Report original input bytes, row/reference/source/resource counts and expanded encoded bytes. Do not call that a producer benchmark, heap measurement, 100 ms gate or performance acceptance.
9. Two separate physical entries with equal bytes and the same exact reference token remain two resource IDs/ambiguous candidates. Repeated slots pointing to one uniquely proven physical ID give several occurrences/links, repeated tokens in mediaReferenceIds and one same-ID membership in assetIds.
10. Valid UTF-8 JSON with an escaped lone-surrogate thread key fails critical locator preparation safely; a 257-code-point actual source handle fails while 256 valid code points fit. No invalid locator/private value appears in the error and no partial dataset/envelope returns. An unsafe/lone-surrogate reference token instead yields its original-slot diagnostic and preserves valid sibling slots. A recognized Location-only Memory row with an inadmissible-scalar value retains its occurrence, null location and exact owned-field diagnostic. Valid paired non-BMP locations/names, multibyte literals and safe array filenames with internal spaces remain positive cases. Actual-reader failures preserve original entry access and valid supported retry.

Freeze exact pre-change singleton and conflated reference/link ID literals from the committed algorithm for the authored C1 case before writing its implementation. Record the fixture row, immutable source keys and physical paths with those literals. The author never calculates an expected retained ID using the new implementation.

### Frozen baseline identity literals

The internal normalizer DTO identity fixture has this exact 74-byte UTF-8 chat document:

```json
{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A","A","B"]}]}
```

Its independently computed original document SHA-256 is `96879b9af523f1167f1f85885838deb0fdbcc2e6e79f5c7a458765f4d1a2487c`. The document entry is metadata / json/chat_history.json / ordinal 0. Its byte length, decoded text and trusted entry envelope agree. For deterministic normalizer identity tests only, the trusted sourceDigests fixture supplies metadata = 64 `1` characters and media = 64 `2` characters. Those are synthetic domain inputs, not claims that a real ZIP has those hashes. Actual-loader tests independently fingerprint actual ZIP bytes and assert source memberships/ordinals rather than these synthetic physical ID literals.

Applying the committed legacy identity algorithm independently to that literal input gives:

| Item | Baseline literal |
| --- | --- |
| Single owning event | `event-36f8422168fc9d41` |
| Original media/A.jpg, media source, ordinal 0 | `asset-f6319a7e6f6212d6` |
| Original media/B.jpg, media source, ordinal 1 | `asset-7058943803a51ccc` |
| Old conflated A reference | `reference-357dd6dc824dc7e4` |
| Valid singleton B reference | `reference-387ddb95ca65d29b` |
| Old conflated A link | `link-586e032ee329541c` |
| Valid singleton B link | `link-1e6b2687d5bb1039` |

Stage 2 preserves the event, both physical IDs and B's singleton reference/link. Neither A slot or its new link may reuse A's conflated reference/link. All three occurrence IDs are distinct under occurrence-v1 identity. Reverse document/entry input order without changing that authority and require the same supported IDs/proof memberships.

### Executed encoded-size preflight

Ran two internal synthetic JavaScript measurements with `pnpm exec node`. The script constructed the concrete proposed DTO records and counted their actual UTF-8 JSON encoding, including array framing. It used independently authored original document strings and standard SHA-256. It printed counts only, aside from the public synthetic identity fixture above. It did not import a private archive, run a provider/service, change tests/code, benchmark a producer or measure heap/latency. The proposed staged normalizer does not exist yet.

| Fixture | Original JSON bytes | Event rows / occurrences / source entries / resources / diagnostics | Staged encoded bytes | Additional compatibility-link bytes |
| --- | --- | --- | --- | --- |
| 100,000 sparse TEXT rows with distinct `word i` messages and no reference field | 5,988,900 | 100,000 / 0 / 100,000 / 0 / 100,000 | 90,866,776 | 0 |
| One IMAGE row containing 4,096 repeated `A` references and one exact original | 16,446 | 1 / 4,096 / 2 / 1 / 0 | 4,169,765 | 2,400,257 |

The sparse case includes all typed absent-reference diagnostics. Its encoded counts fit each proposed default and leave a possible 100,000-text-event path. This does not establish the remaining whole-archive/domain allocations or direct-control performance gate. The repeated case expands its staged representation to 253.54 times its original document encoding; charging compatibility links makes the measured expanded total 6,570,022 bytes. Its largest occurrence is 1,017 bytes. This demonstrates why document limits alone cannot bound occurrence expansion. The count/field/output limits reject larger admitted documents as a whole instead of exposing a subset. Actual stage-2 producer output and adversarial sparse/copy/ambiguity measurements must recheck these proposals before author acceptance.

These stage-2 ceilings do not admit the original Phase 8 one-million-event imported-history scenario. They are staged safety policy, not a permanent product maximum or a passed scale claim. Later measured compact-representation or policy work must admit the actual complete million-event import before that phase closes. Do not raise these ceilings now without evidence or substitute a smaller selected/prepared population for that original gate.

## Serial ownership and remaining gates

After independent review and explicit root transfer, own only dataset.ts, types/dataset.ts, a focused datasetOccurrences test file and necessary existing dataset/document/lifecycle regression edits or internal fixture helper. Run vertical public red-to-green cases, retain byte-proof/physical identity protections, then affected tests, full regular units, a redacted build and actual internal-ZIP browser regressions once stable. No public fixture factory or demo path.

No owner-decision helper, new layers/support resolver, signed QueryTime conversion, membership/participation/owner extension, canonical whole-model validator/publication, worker/read cancellation protocol, store/persistence/UI/filter activation or alternate query engine is authorized. Full query evidence stays unavailable. Further type authority, time/membership/layers, active-read cancellation, aggregate native-memory behavior, complete original 100,000-event responsiveness and full Phases 2/3/5 remain separate gates.
