# Spacing and control standards

The shared stylesheet defines a 4 px spacing scale (4, 8, 12, 16, 20, 24, 32). Forms use 16 px between fields and 8 px between a label and its control. Cards use 20 px padding on desktop and 16 px on mobile; dialogs use 24 px and 20 px respectively. Main content, header and tab gutters share one responsive token.

Standard text buttons, single-line inputs and selects have a 36 px minimum height on desktop and 44 px on touch layouts. Content may expand rather than clip. They share 10 px horizontal padding and the existing 9 px control radius. Single-line inputs and selects use the same responsive border-box height; text buttons can grow for wrapped labels. Login fields and the login action use the same responsive standard. Textareas remain multiline; checkboxes and radios retain native geometry.

Icon actions use 32 px squares on desktop and 44 px on mobile. The narrow workspace rail uses a 40 × 44 px mobile target within its existing 42 px column. Calendar event chips remain compact 28 px controls, and project tabs retain their navigation sizing. Layout resize handles retain their 14 px visual square, 24 px pointer target and selected-object stacking order.

Keyboard focus remains visible. Mobile fields use 16 px type to prevent focus zoom. Flexible grids, wrapping text and buttons prevent narrow layouts from forcing horizontal page scrolling. These tokens change presentation only; permissions, account state and persistence are unchanged.

Member and organization equipment use the same 200 px owner selector, control height, padding and tab row on desktop; both wrap the selector above the tabs on mobile. Loading placeholders reserve the same selector geometry. Independent equipment entry reads run in parallel, reuse only the current entry's inventory response, and refetch after mutations. Organization details are read on the organization management tab; unused personal invitations and claims do not block the equipment list.
