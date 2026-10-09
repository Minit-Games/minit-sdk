# FAQ

Answers to common creator questions about Minit Games platform behavior.

## What limits apply to my game, and what happens when I exceed one?

Every creator-facing size and length limit, when it applies, and whether exceeding it rejects, truncates, or silently drops your input. The topic guides on [minit.studio/docs](https://minit.studio/docs) remain the detailed references for each feature.

### Failure modes at a glance

- **Reject**: the save, request, upload, or upload-processing step fails.
- **Silent truncation**: the operation succeeds, but only the allowed prefix is kept.
- **Silent drop**: the operation succeeds, but the over-limit field, item, or value is not kept.
- The create wizard may warn about a limit before upload. Those warnings are advisory; the failure mode in the table is what the platform ultimately enforces.

### Complete limits table

| Subject | Value | When it applies | Failure mode |
|---|---:|---|---|
| Result `flavorText` | 64 characters | Runtime, when a play result is reported | **Silent truncation:** the result succeeds and only the first 64 characters are stored. |
| Result `userData` value | 1,024 UTF-8 bytes | Runtime, when a play result writes user data | **Silent drop:** the play report still succeeds, but the oversized value is discarded. |
| Project title | 50 characters | Authoring in Studio or seeding from `meta.json` on the founding upload | **Reject** for an over-limit Studio/API edit; **silent truncation** when seeded from `meta.json`. |
| Project description | 2,500 characters total across description, `logic`, and `controls` | Authoring in Studio or seeding from `meta.json` on the founding upload | **Reject** for an over-limit Studio/API edit; **silent truncation** on upload. Upload trimming removes body text first, then `logic`, then `controls`. |
| `meta.json` config entries | 25 entries | Upload, when `config` is read | **Silent drop:** the whole invalid `config` block is discarded while the upload continues. A direct validated submission is rejected instead. |
| Config-entry description | 100 characters | Upload, for each `config[].description` | **Silent drop:** only the over-limit description is discarded. A direct validated submission is rejected instead. |
| Root `index.html` | 10 MiB (10,485,760 bytes) | Upload validation | **Reject:** the game ZIP is rejected. |
| Compressed game ZIP | 50 MiB (52,428,800 bytes) | Upload | **Reject:** the upload is rejected. |
| Files in a game ZIP | 2,000 files | Upload processing | **Reject:** processing fails when another file entry is encountered. |
| One uncompressed ZIP entry | 50 MiB (52,428,800 bytes) | Upload processing | **Reject:** processing fails. |
| Total uncompressed ZIP contents | 300 MiB (314,572,800 bytes) | Upload processing | **Reject:** processing fails. |
| Cover image file | 8 MiB (8,388,608 bytes) | Cover upload | **Reject:** the cover upload is rejected. |
| Cover image dimensions | 780 × 1,340 pixels | Cover upload processing | **Reject:** processing fails unless both dimensions match exactly. |
| Analysed asset path | 512 characters | Upload asset analysis and validated asset data | **Silent drop** during asset analysis; a directly validated over-limit asset entry is **rejected**. |
| Moddable asset slot name | 100 characters | Authoring a moddable asset declaration | **Reject:** the declaration is rejected. |
| Moddable asset slot description | 500 characters | Authoring a moddable asset declaration | **Reject:** the declaration is rejected. |
| Post caption | 80 characters | Authoring or auto-generating a Post caption | **Reject** for an over-limit submitted caption; an auto-generated default is **silently truncated**. |
| Project tags | 10 tags | Authoring/normalizing project tags | **Silent drop:** tags after the first 10 kept tags are discarded. Strict validated input may be rejected before normalization. |
| One project tag | 30 characters | Authoring/normalizing project tags | **Silent truncation** during normalization. Strict validated input may be rejected before normalization. |
| Credits edited in Studio | 2,500 characters | Authoring in the Studio Credits editor | **Reject:** Studio cannot save over-limit credits. |
| Runtime locale override | 35 characters | Runtime, for the host locale query override | **Silent drop:** an over-limit override is ignored and the normal locale remains in effect. |

### Credits have two different paths

- **Bundle path:** the `credits` field in `meta.json` is uncapped.
- **Studio path:** the Credits editor accepts up to 2,500 characters and rejects a longer value.
- A later bundle re-upload or repatch makes `meta.json` authoritative again, including an uncapped `credits` value.
- See [Config Values](https://minit.studio/docs/meta-json-reference) and [Licensing third-party content](https://minit.studio/docs/licensing-third-party-content) for the full licensing workflow.

### Related guides

- [Platform Requirements](https://minit.studio/docs/platform-requirements) covers bundle and runtime requirements.
- [Reporting Results](https://minit.studio/docs/reporting-results) covers `flavorText` and result reporting.
- [Saving User Data](https://minit.studio/docs/saving-user-data) covers user-data setup and writes.
- [Writing & formatting your Game description](https://minit.studio/docs/writing-your-description) covers the shared description budget.
- [Config Values](https://minit.studio/docs/meta-json-reference) covers `meta.json` field behavior.
- [Licensing third-party content](https://minit.studio/docs/licensing-third-party-content) covers credits and notices.
