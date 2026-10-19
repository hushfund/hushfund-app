/** Runtime settings must load before modules create wallet/auth clients. */
async function bootstrap() {
  try {
    await window.__HUSHFUND_ENV_READY__;
    if (!window.__HUSHFUND_ENV__) throw new Error("Public settings were not loaded");
    await import('./main.tsx')
  } catch {
    const root = document.getElementById('root')
    if (root) {
      root.setAttribute('role', 'alert')
      root.style.cssText = 'max-width:640px;margin:64px auto;padding:24px;font:16px/1.6 system-ui;color:#f3f3f3;background:#161616;border-radius:12px'
      const title = document.createElement('h1')
      title.textContent = 'Application settings are unavailable'
      const message = document.createElement('p')
      message.textContent = 'Check that the Hushfund API is running and its mainnet public settings are valid, then reload this page.'
      const retry = document.createElement('button')
      retry.textContent = 'Reload page'
      retry.onclick = () => window.location.reload()
      root.replaceChildren(title, message, retry)
    }
    console.error('Hushfund could not load its public configuration.')
  }
}
void bootstrap()
export {}
