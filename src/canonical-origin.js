// Run before the application: never start login/API code on canonical HTTP.
(() => {
  const current = window.location;
  if (current.protocol === 'http:' && current.hostname === 'studio.wonjongyou.com' && (!current.port || current.port === '80')) {
    current.replace('https://studio.wonjongyou.com' + current.pathname + current.search + current.hash);
    return;
  }
  const start = () => {
    const app = document.createElement('script');
    app.type = 'module';
    app.src = '/src/app.js';
    document.body.append(app);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
