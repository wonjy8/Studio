export function loginPage() {
  return `<main class="login-page">
    <a class="login-brand" href="/" aria-label="Studio 홈"><span class="brand-mark" aria-hidden="true">s</span>Studio<span class="brand-period" aria-hidden="true">.</span></a>
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-heading"><p class="eyebrow">YOUR NEXT SHOOT STARTS HERE</p><h1 id="login-title">다시, Studio에서.</h1><p>준비부터 촬영까지, 한곳에서 이어가세요.</p></div>
      <form class="form login-form" id="login">
        <div class="field"><label for="login-username">사용자 이름</label><input id="login-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="사용자 이름을 입력하세요" required maxlength="64"></div>
        <div class="field"><label for="login-password">비밀번호</label><div class="password-control"><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required maxlength="256"><button class="password-toggle" type="button" aria-controls="login-password" aria-pressed="false" aria-label="비밀번호 표시">보기</button></div></div>
        <p class="login-error" role="alert" id="login-error"></p>
        <button class="btn primary login-submit" type="submit">로그인 <span aria-hidden="true">↗</span></button>
      </form>
      <p class="login-help">계정이 필요하거나 비밀번호를 잊었다면<br>Studio 관리자에게 문의하세요.</p>
    </section>
    <footer class="login-footer"><span>준비는 차분하게. 촬영은 가볍게.</span><span>Studio · Production workspace</span></footer>
  </main>`;
}
