// Studio workspace symbols, drawn on the Ionicons 512px canvas with paired variants.
// Keep their geometry aligned with docs/ICON_AUTHORING_GUIDE.md.
const house='M64 224 256 64 448 224V240H416V432H304V352A48 48 0 0 0 208 352V432H96V240H64Z';
const rearSheet='M280 82H392A32 32 0 0 1 424 114V302A32 32 0 0 1 392 334H280A32 32 0 0 1 248 302V114A32 32 0 0 1 280 82Z';
const frontSheet='M112 188H232L304 260V412A32 32 0 0 1 272 444H112A32 32 0 0 1 80 412V220A32 32 0 0 1 112 188Z';
const fold='M232 188V244A16 16 0 0 0 248 260H304';
export const workspaceIconPaths={
 'workspace-home':{
  outline:`<path d="${house}"/>`,
  filled:`<path d="${house}"/>`
 },
 'workspace-materials':{
  outline:`<g transform="rotate(17 336 208)"><path d="${rearSheet}"/></g><g transform="rotate(-7 192 316)"><path d="${frontSheet}"/><path d="${fold}"/></g>`,
  filled:`<g transform="rotate(17 336 208)"><path d="${rearSheet}"/></g><g transform="rotate(-7 192 316)"><path d="${frontSheet}" style="stroke:var(--surface);stroke-width:20px"/><path d="${fold}" style="fill:none;stroke:var(--surface);stroke-width:24px"/></g>`
 }
};
