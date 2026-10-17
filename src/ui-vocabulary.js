// Studio UI vocabulary
// Product hierarchy: Workspace → Project → Shoot.
// `Shoot` is the user-facing name for the entity previously labeled Content.
const replacements = new Map([
  ['콘텐츠', '촬영'],
  ['＋ 콘텐츠 추가', '＋ 촬영 추가'],
  ['콘텐츠 추가', '촬영 추가'],
  ['콘텐츠 이름', '촬영 이름'],
  ['콘텐츠 준비 항목 확인', '촬영 준비 항목 확인'],
  ['시간, 콘텐츠, 준비 상태를 같은 맥락에서 봅니다.', '시간, 촬영, 준비 상태를 같은 맥락에서 봅니다.'],
  ['각 촬영 단위를 중심으로 대본·인원·카메라·레퍼런스를 연결합니다.', '각 촬영을 중심으로 대본·인원·카메라·레퍼런스·장비를 연결합니다.']
]);

function applyVocabulary(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const next = replacements.get(node.nodeValue.trim());
    if (!next) continue;
    const leading = node.nodeValue.match(/^\s*/)?.[0] ?? '';
    const trailing = node.nodeValue.match(/\s*$/)?.[0] ?? '';
    node.nodeValue = `${leading}${next}${trailing}`;
  }
}

applyVocabulary();

new MutationObserver(() => applyVocabulary(document.querySelector('#app')))
  .observe(document.querySelector('#app'), { childList: true, subtree: true });
