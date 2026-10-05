// Offline render of the procedural music + SFX (OfflineAudioContext in Chromium) -> artifacts/audio/*.wav/.mp3.
// Usage: node scripts/audio-render.mjs [seconds=32] — renders the beat (with hype rising) and a hit/whoosh test reel.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const [, , secArg = '32'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(`${base}/?touch=0`);
await page.waitForFunction(() => window.__rb?.audio, null, { timeout: 300000 });
const render = async (what) =>
  page.evaluate(
    async ({ what, secs }) => {
      const SR = 44100;
      const Engine = window.__rb.audio.constructor;
      const off = new OfflineAudioContext(2, SR * secs, SR);
      const RealAC = window.AudioContext;
      window.AudioContext = function () {
        return off;
      };
      const e = new Engine();
      e.unlock();
      window.AudioContext = RealAC;
      const BEAT = 60 / 90;
      if (what === 'beat') {
        let t = 0.05;
        for (let st = 0; t < secs - 1; st++) {
          e.hype = Math.min(1, st / (16 * 12));
          e.playStep(st % (16 * 32), t);
          t += (BEAT / 4) * (st % 2 === 0 ? 1.1 : 0.9);
        }
      } else {
        e.sfxVol = 1;
        const at = (sec, fn) => {
          const orig = off.currentTime;
          void orig;
          e.now = () => sec;
          fn();
        };
        let t = 0.2;
        for (const s of [0, 1, 2, 3]) {
          at(t, () => e.whoosh(s));
          at(t + 0.08, () => e.hit(s, false));
          t += 0.8;
        }
        at(t, () => e.hit(3, true));
        t += 1.0;
        at(t, () => e.block(2));
        t += 0.6;
        at(t, () => e.slam());
        t += 1.0;
        at(t, () => e.carIn());
        t += 1.6;
        at(t, () => e.sparkle());
      }
      const buf = await off.startRendering();
      // 16-bit WAV
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      const n = buf.length;
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF');
      out.setUint32(4, 36 + n * 4, true);
      w(8, 'WAVEfmt ');
      out.setUint32(16, 16, true);
      out.setUint16(20, 1, true);
      out.setUint16(22, 2, true);
      out.setUint32(24, SR, true);
      out.setUint32(28, SR * 4, true);
      out.setUint16(32, 4, true);
      out.setUint16(34, 16, true);
      w(36, 'data');
      out.setUint32(40, n * 4, true);
      let peak = 0;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 2; c++) {
          const v = Math.max(-1, Math.min(1, ch[c][i]));
          peak = Math.max(peak, Math.abs(ch[c][i]));
          out.setInt16(44 + (i * 2 + c) * 2, v * 32767, true);
        }
      const bytes = new Uint8Array(out.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), peak };
    },
    { what, secs: what === 'beat' ? Number(secArg) : 9 },
  );
for (const what of ['beat', 'sfx']) {
  const { b64, peak } = await render(what);
  const wav = `artifacts/audio/${what}.wav`;
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  execSync(`ffmpeg -y -loglevel error -i ${wav} -b:a 160k artifacts/audio/${what}.mp3`);
  const stats = execSync(`ffmpeg -i ${wav} -af astats=metadata=1:reset=0 -f null - 2>&1 | grep -E "Peak level dB|RMS level dB" | tail -2`).toString().trim();
  console.log(what, 'peak', peak.toFixed(3), '\n' + stats);
}
await browser.close();
