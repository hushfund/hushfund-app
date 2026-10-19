/* Static-hosting loader. The API supplies only explicitly allowlisted public settings. */
(() => {
  const base = new URL(".", document.currentScript.src);
  window.__HUSHFUND_ENV_READY__ = fetch(new URL("api/public-env", base), {
    cache: "no-store",
    credentials: "same-origin",
  }).then(response => {
    if (!response.ok) throw new Error("Public configuration is unavailable");
    return response.json();
  }).then(values => {
    if (values.VITE_NETWORK !== "mainnet") throw new Error("Ethereum Mainnet is required");
    window.__HUSHFUND_ENV__ = Object.freeze(values);
  });
  // Avoid an unhandled rejection before the module bootstrap attaches its handler.
  window.__HUSHFUND_ENV_READY__.catch(() => {});
})();
