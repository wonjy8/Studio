// Original filled artwork. Common 24px grid and optical weight for scene objects.
const shapes={
 person:'<circle cx="12" cy="4.5" r="3"/><path d="M7 9c3-2 7-2 10 0l3 8h-5v6H9v-6H4Z"/>',
 table:'<rect x="2" y="6" width="20" height="5" rx="1.5"/><path d="M4 10h3v11H4zm13 0h3v11h-3z"/>',
 chair:'<rect x="5" y="2" width="14" height="9" rx="2"/><rect x="4" y="12" width="16" height="4" rx="1"/><path d="M5 15h3v8H5zm11 0h3v8h-3z"/>',
 stage:'<path d="M2 4h20v10H2zm0 12h12v3H2zm0 5h20v2H2zm14-5h6v3h-6z"/>',
 equipment:'<path fill-rule="evenodd" d="M8 2h8a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2zm1 3v2h6V5zm1 7v4h4v-4z"/>',
 other:'<path d="m12 1 10 5-10 5L2 6zm-10 8 9 4.5V23L2 18zm11 4.5L22 9v9l-9 5z"/>'
};
export function layoutIcon(kind){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="none">${shapes[kind]||shapes.other}</svg>`;}
