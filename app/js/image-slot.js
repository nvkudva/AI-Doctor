import { html, Component } from '../vendor/preact-htm.js';

// Simple upload slot — stand-in for the design project's image-slot.js.
// Click → file picker → image preview. Nothing is persisted or uploaded anywhere.
export class ImageSlot extends Component {
  state = { src: null, name: '' };

  pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,.pdf';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (/^image\//.test(f.type)) {
        this.setState({ src: URL.createObjectURL(f), name: f.name });
      } else {
        this.setState({ src: null, name: f.name });
      }
    };
    inp.click();
  };

  render({ placeholder = 'Upload', radius = 14, style = '' }, { src, name }) {
    return html`
      <div onClick=${this.pick} title=${name || placeholder}
        style="cursor:pointer;position:relative;overflow:hidden;border-radius:${radius}px;background:rgba(255,255,255,.85);border:1.5px dashed rgba(60,90,150,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;${style}">
        ${src
          ? html`<img src=${src} alt=${name} style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`
          : html`
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="#5F7CC4" stroke-width="1.8" stroke-linecap="round"/><path d="M12 15V3m0 0L8 7m4-4l4 4" stroke="#5F7CC4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div style="font-size:11.5px;font-weight:600;color:#5A6B82;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name || placeholder}</div>`}
      </div>`;
  }
}
