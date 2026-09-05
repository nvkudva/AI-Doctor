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

export function getQueryParam(name: string): string | null {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

export function setDocumentTitle(title: string): void {
  try {
    document.title = title;
  } catch {
    /* non-DOM environment */
  }
}

export function speechSupported(): boolean {
  try {
    const w = window as any;
    return !!(window.speechSynthesis && (w.SpeechRecognition || w.webkitSpeechRecognition));
  } catch {
    return false;
  }
}
