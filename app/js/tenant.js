// Multi-tenancy stub (PRD multi-tenancy, UC-4 onboarding).
// Tenant resolves from subdomain (<hospital>.vd.app) or ?hospital=slug.
// Unknown slugs get a prettified name so a second hospital works with zero code.

export function resolveTenant() {
  try {
    const q = new URLSearchParams(location.search).get('hospital');
    if (q) return q.toLowerCase();
    const host = location.hostname.split('.')[0].toLowerCase();
    if (host && host !== 'localhost' && host !== 'www' && host !== '') return host;
  } catch (e) {}
  return 'demo';
}

export function tenantInfo(slug) {
  if (slug === 'demo') return { name: 'Virtual Doctor' };
  const pretty = String(slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { name: (pretty || 'Virtual Doctor') + ' · Virtual Doctor' };
}

export function applyTenant() {
  const slug = resolveTenant();
  const info = tenantInfo(slug);
  try { document.title = info.name; } catch (e) {}
  return { slug, ...info };
}
