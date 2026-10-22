# Continuous A4 document surface

The shared block editor uses a210mm-wide paper surface with20mm desktop writing margins and a297mm minimum height. Longer content extends continuously, with no page-break nodes, repeated page backgrounds or layout-driven DOM reconstruction. Narrow containers reflow at readable16px body type instead of scaling an A4 canvas down. Images retain their intrinsic aspect ratio.

This applies to shared block-editor documents, including project/personal documents, lecture notes, preserved syllabus documents and legacy Scripture notes. The dedicated QT split editor and structured inline syllabus keep their own layouts. No document data/schema, selection handlers, composition, history, or autosave behavior is changed.

Printing uses a named A4 page with20mm margins. Only the active document surface prints; navigation, menus, block controls and empty placeholders are omitted. A print-only heading mirrors the current editable title so multi-line titles can paginate naturally. Text can fragment across pages with widow/orphan hints; headings stay with following content and images fit the printable page while preserving their ratio. Browser print dialog settings can override CSS page sizing/margins.

Isolated browser verification covers a100-paragraph document with a long paragraph and image, continuous typing, synthetic Korean composition events (not an OS IME), paste, selection during scroll, undo/redo, autosave and reload. Widths1440/640/390/320 and light/dark screens are checked. Generated multi-page PDF is inspected with pdfinfo/pdftotext for A4 size and complete paragraph markers/title/long content without editor chrome. Existing editor/menu/touch-reorder, School course and Scripture/QT split-view browser regressions also run.
