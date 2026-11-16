// Client-side navigation from anywhere, without passing onNavigate down.
// App listens for popstate and re-reads the URL, so firing one here updates the page.
export function navigateTo(url: string) {
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function replaceTo(url: string) {
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}