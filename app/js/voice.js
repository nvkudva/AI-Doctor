// Voice provider seam (ARCH voice pipeline).
// BrowserVoice (Web Speech API) is the current implementation and always works.
// A remote STT/TTS endpoint (Deepgram + Chirp) takes over only when
// vd_voice_endpoint is set in localStorage. Typed input stays available either way.

export function voiceBackend() {
  try { return localStorage.getItem('vd_voice_endpoint') ? 'remote' : 'browser'; }
  catch (e) { return 'browser'; }
}

export function pickVoice(voices) {
  const vs = voices || [];
  return vs.find(x => /en/i.test(x.lang) && /female|samantha|karen|victoria|zira|google uk english female/i.test(x.name))
    || vs.find(x => /en/i.test(x.lang));
}

export function speechSupported() {
  try {
    return !!(window.speechSynthesis && (window.SpeechRecognition || window.webkitSpeechRecognition));
  } catch (e) { return false; }
}
