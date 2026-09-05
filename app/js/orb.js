import { html } from '../vendor/preact-htm.js';

// Animated Dr. Mira orb sphere. Scale: set font-size on the sized parent
// (blur/shadows are em-based); font-size 138px = original large-orb look.
export function MiraOrb() {
  return html`
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#F4FAFF">
      <div style="position:absolute;inset:-20%;animation:vd-spin 9s linear infinite">
        <div style="position:absolute;top:5%;left:12%;width:70%;height:70%;border-radius:50%;background:oklch(0.75 0.16 230);filter:blur(0.116em)"></div>
        <div style="position:absolute;bottom:2%;right:8%;width:65%;height:65%;border-radius:50%;background:oklch(0.72 0.18 310);filter:blur(0.13em)"></div>
      </div>
      <div style="position:absolute;inset:-20%;animation:vd-spin-r 13s linear infinite">
        <div style="position:absolute;top:30%;right:5%;width:60%;height:60%;border-radius:50%;background:oklch(0.78 0.15 190);filter:blur(0.101em)"></div>
        <div style="position:absolute;bottom:15%;left:5%;width:50%;height:50%;border-radius:50%;background:oklch(0.75 0.17 350);filter:blur(0.116em);animation:vd-drift 7s ease-in-out infinite"></div>
      </div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 33% 22%,rgba(255,255,255,.9),rgba(255,255,255,0) 42%);box-shadow:inset 0 -0.116em 0.188em oklch(0.4 0.13 275 / .4),inset 0 0.0725em 0.116em rgba(255,255,255,.5),inset 0 0 0 1px rgba(255,255,255,.85)"></div>
    </div>`;
}
