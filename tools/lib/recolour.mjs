// recolour.mjs: turn the blues of a texture to another colour, keeping their light and shade
// (the mechanics' twin outfits: tools/build-characters.mjs). Skin, white, gold and brown stay.
import sharp from 'sharp';

/** The mechanics' colours: the hue the blues turn to, how much to lift dark navy so it isn't brown. */
export const MECH_TONES = {
  red: { hue: 356, lift: 0.08, sat: 1.0 },
  green: { hue: 152, lift: 0.04, sat: 0.85 },
  orange: { hue: 27, lift: 0.4, sat: 1.0 },
};

const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
};
const rgb = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
};

/** A copy of the picture `buf` with its blues turned to `tone` (a MECH_TONES entry). PNG out. */
export async function recolour(buf, tone) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, v] = hsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (h < 185 || h > 255 || s < 0.22) continue;
    // fade in at the edges of the blue range so nothing gets a hard line
    const k = Math.min(1, (h - 185) / 12, (255 - h) / 12, (s - 0.22) / 0.1);
    const nh = (tone.hue + (h - 218) * 0.25 + 360) % 360;
    const nv = v + tone.lift * (1 - v) * k;
    const [r, g, b] = rgb(nh, Math.min(1, s * tone.sat), nv);
    data[i] = Math.round((r * k + (data[i] / 255) * (1 - k)) * 255);
    data[i + 1] = Math.round((g * k + (data[i + 1] / 255) * (1 - k)) * 255);
    data[i + 2] = Math.round((b * k + (data[i + 2] / 255) * (1 - k)) * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}
