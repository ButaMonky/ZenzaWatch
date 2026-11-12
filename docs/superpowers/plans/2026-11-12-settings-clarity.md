# Settings clarity implementation plan

**Goal:** Apply the approved before/after settings design without changing stored preferences or click-launch behavior; publish verified shared settings and external trial updates to both repositories, then research click interoperability.

**Architecture:** Keep the existing model/controller and TypeScript generation. Express conditional availability in descriptors; UI consumes the same availability result for controls and explanations. External settings keep their shared GM slot and use the same metadata in the recovery panel.

**Spec:** User-approved comparison in this conversation: preserve navy palette/navigation/search/save, compact related settings, inactive children with reason and retained values, suitable inputs, unavailable legacy controls clearly separated.

## Tasks
- [x] Add tested conditional availability and compact related controls to advanced settings TypeScript; regenerate JavaScript.
- [x] Update external site controls and short wildcard guidance; test disabled editing, retained entries, and current-site insertion.
- [x] Verify root and affected TypeScript/UI tests, build versioned normal release and rebased external trial, independently review changes.
- [x] Commit and push normal release and trial to public and private repositories. Verify remote heads.
- [x] Read original click-launch issues/comments, existing experiments and handlers. Analyze general event-ownership alternatives without adding script-specific exceptions or changing release click behavior.

## Review focus
- Disabling a parent retains child values across save/reopen.
- Equality dependency inherits parent availability and cannot recurse forever.
- Search and duplicate settings placements show the same draft and disabled state.
- Unsupported settings remain preserved, without pretending they work.
- External recovery panel remains usable when external playback is disabled.

## Execution notes
User explicitly approved implementation and both pushes; no repeated approval needed. Existing release and experiment worktrees are isolated. Unrelated logs and temporary dist files stay untouched. External playback remains an experimental separately installed script, not silently merged into normal installation.
