import { html } from '../vendor/preact-htm.js';

// Simplified iOS 26 device frame — port of ios-frame.jsx (IOSDevice + IOSStatusBar).
// The app uses it without title/keyboard, so only those two pieces are ported.

function IOSStatusBar({ dark = false, time = '9:41' }) {
  const c = dark ? '#fff' : '#000';
  return html`
    <div style="display:flex;gap:154px;align-items:center;justify-content:center;padding:21px 24px 19px;position:relative;z-index:20;width:100%">
      <div style="flex:1;height:22px;display:flex;align-items:center;justify-content:center;padding-top:1.5px">
        <span style="font-family:-apple-system,'SF Pro',system-ui;font-weight:590;font-size:17px;line-height:22px;color:${c}">${time}</span>
      </div>
      <div style="flex:1;height:22px;display:flex;align-items:center;justify-content:center;gap:7px;padding-top:1px;padding-right:1px">
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill=${c}/>
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill=${c}/>
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill=${c}/>
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill=${c}/>
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill=${c}/>
          <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill=${c}/>
          <circle cx="8.5" cy="10.5" r="1.5" fill=${c}/>
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke=${c} stroke-opacity="0.35" fill="none"/>
          <rect x="2" y="2" width="20" height="9" rx="2" fill=${c}/>
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill=${c} fill-opacity="0.4"/>
        </svg>
      </div>
    </div>`;
}

export function IOSDevice({ children, width = 402, height = 874, dark = false }) {
  return html`
    <div style="width:${width}px;height:${height}px;border-radius:48px;overflow:hidden;position:relative;background:${dark ? '#000' : '#F2F2F7'};box-shadow:0 40px 80px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.12);font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;flex:none">
      <div style="position:absolute;top:11px;left:50%;transform:translateX(-50%);width:126px;height:37px;border-radius:24px;background:#000;z-index:50"></div>
      <div style="position:absolute;top:0;left:0;right:0;z-index:10">
        <${IOSStatusBar} dark=${dark} />
      </div>
      <div style="height:100%;display:flex;flex-direction:column">
        <div style="flex:1;overflow:auto">${children}</div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;z-index:60;height:34px;display:flex;justify-content:center;align-items:flex-end;padding-bottom:8px;pointer-events:none">
        <div style="width:139px;height:5px;border-radius:100px;background:${dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'}"></div>
      </div>
    </div>`;
}
