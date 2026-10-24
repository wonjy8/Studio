export function loginPage() {
  return `<main class="login-page">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-heading"><h1 id="login-title">로그인</h1></div>
      <form class="form login-form" id="login">
        <div class="field"><label for="login-username">사용자 이름</label><input id="login-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="64"></div>
        <div class="field"><label for="login-password">비밀번호</label><div class="password-control"><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button class="password-toggle" type="button" aria-controls="login-password" aria-pressed="false" aria-label="비밀번호 표시">보기</button></div></div>
        <label class="login-remember"><input type="checkbox" name="rememberMe" aria-describedby="login-remember-help"> 로그인 유지</label>
        <p class="sub" id="login-remember-help">선택하면 30일 동안 로그인을 유지합니다.</p>
        <p class="login-error" role="alert" id="login-error"></p>
        <button class="btn primary login-submit" type="submit">로그인</button>
      </form>
    </section>
  </main>`;
}
