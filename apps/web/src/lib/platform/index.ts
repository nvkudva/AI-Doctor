// Thin wrappers over browser capabilities. App/feature code calls these;
// presentational components never touch browser APIs directly.

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — records stay in memory */
  }
}

export function setDocumentTitle(title: string): void {
  try {
    document.title = title;
  } catch {
    /* non-DOM environment */
  }
}
