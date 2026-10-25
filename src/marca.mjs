// ─────────────────────────────────────────────────────────────────────────────
// marca.mjs — Rampas de marca en OKLCH, portadas de scripts/generar-marca.py
//
// El repo Ntizar/Aurora es la autoridad: esto es una traducción fiel de su
// generador para poder crear una marca en caliente (el color detectado en el
// PDF) sin salir del sistema. Se sirve como CSS por /marca/<slug>.css, así el
// HTML generado NO lleva ni un hex a mano: solo data-nz-marca + un <link>.
// ─────────────────────────────────────────────────────────────────────────────

const L_MARCA = { 50: 0.425, 100: 0.390, 200: 0.339, 300: 0.262, 400: 0.158, 500: 0.077, 600: 0.0, 700: -0.058, 800: -0.122, 900: -0.167 };
const L_ACENTO = { 50: 0.348, 100: 0.313, 200: 0.262, 300: 0.185, 400: 0.081, 500: 0.0, 600: -0.077, 700: -0.135 };

const srgbALineal = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linealASrgb = (c) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };

export function hexARgb(hx) {
  hx = String(hx).trim().replace(/^#/, '');
  if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hx)) throw new Error(`hex inválido: ${hx}`);
  return [0, 2, 4].map((i) => parseInt(hx.slice(i, i + 2), 16));
}

export function hexAOklch(hx) {
  const [r, g, b] = hexARgb(hx).map(srgbALineal);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const [l_, m_, s_] = [l, m, s].map((v) => Math.cbrt(v));
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

export function oklchAHex(L, C, H) {
  const a = (H * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const aLineal = (Cv) => {
    const A = Cv * ca;
    const B = Cv * sa;
    const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
    const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
    const s_ = L - 0.0894841775 * A - 1.2914855480 * B;
    const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  };
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (aLineal(mid).every((v) => v >= -1e-4 && v <= 1 + 1e-4)) lo = mid;
    else hi = mid;
  }
  const rgb = aLineal(lo).map((v) => Math.round(linealASrgb(v) * 255));
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const luminancia = (hx) => {
  const [r, g, b] = hexARgb(hx).map(srgbALineal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function luzDe(luzFuente, off) {
  const REF = 0.546;
  const TECHO = 0.97;
  const SUELO = 0.1;
  if (off === 0) return luzFuente;
  const escala = off > 0
    ? Math.min(1, Math.max(0.05, TECHO - luzFuente) / (TECHO - REF))
    : Math.max(0.05, luzFuente - SUELO) / (REF - SUELO);
  return Math.min(TECHO, Math.max(SUELO, luzFuente + off * escala));
}

function rampa(hexBase, offsets, ancla) {
  const [luzFuente, cromaFuente, tono] = hexAOklch(hexBase);
  const pasos = Object.keys(offsets).map(Number);
  const iAncla = pasos.indexOf(ancla);
  const salida = {};
  pasos.forEach((paso, i) => {
    if (paso === ancla) { salida[paso] = hexBase.toLowerCase(); return; }
    const d = Math.abs(i - iAncla);
    const croma = cromaFuente * (d <= 1 ? 1 : d === 2 ? 0.85 : d === 3 ? 0.62 : 0.4);
    salida[paso] = oklchAHex(luzDe(luzFuente, offsets[paso]), croma, tono);
  });
  return salida;
}

export function ajustarAA(hexBase, objetivo = 4.5, contra = '#ffffff') {
  if (contraste(hexBase, contra) >= objetivo) return { hex: hexBase, ratio: contraste(hexBase, contra), ajustado: false };
  let [luz, croma, tono] = hexAOklch(hexBase);
  for (let i = 0; i < 90; i++) {
    luz -= 0.004;
    if (luz < 0.15) break;
    const cand = oklchAHex(luz, croma, tono);
    if (contraste(cand, contra) >= objetivo) return { hex: cand, ratio: contraste(cand, contra), ajustado: true };
  }
  return { hex: hexBase, ratio: contraste(hexBase, contra), ajustado: false };
}

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'marca';

// ── API principal ────────────────────────────────────────────────────────────
// Devuelve { slug, marca, acento, css, contraste } listo para servir.
export function generarMarca(nombre, colorMarca, colorAcento) {
  const slug = slugify(nombre);
  const m = ajustarAA(String(colorMarca || '#2563eb'));
  const a = String(colorAcento || '#f97316');

  const rm = rampa(m.hex, L_MARCA, 600);
  const ra = rampa(a, L_ACENTO, 500);

  // Garantía AA del par acento-700 sobre acento-50 (igual que el generador del repo)
  if (contraste(ra[700], ra[50]) < 4.5) {
    let [luz, croma, tono] = hexAOklch(ra[700]);
    for (let i = 0; i < 90; i++) {
      luz -= 0.004;
      if (luz < 0.25) break;
      const cand = oklchAHex(luz, croma, tono);
      ra[700] = cand;
      if (contraste(cand, ra[50]) >= 4.5) break;
    }
  }

  const lineas = [
    `/* Aurora · marca «${slug}» — generada por pdf-to-landing (rampas OKLCH)`,
    `   marca ${m.hex}${m.ajustado ? ` (ajustada desde ${String(colorMarca).toLowerCase()} para AA)` : ''} · acento ${a}`,
    `   Activa con: <html data-nz-marca="${slug}">`,
    `   Hecho con ❤️ por David Antizar */`,
    ``,
    `[data-nz-marca="${slug}"] {`,
    `  /* rampa de marca (primario) */`,
    ...Object.entries(rm).map(([k, v]) => `  --nz-marca-${k}: ${v};`),
    `  /* rampa de acento (secundario) */`,
    ...Object.entries(ra).map(([k, v]) => `  --nz-acento-${k}: ${v};`),
    `}`,
    ``,
  ];

  return {
    slug,
    marca: m.hex,
    acento: a,
    ajustada: m.ajustado,
    css: lineas.join('\n'),
    contraste: {
      'blanco sobre marca-600': +contraste(rm[600], '#ffffff').toFixed(2),
      'tinta sobre acento-500': +contraste(ra[500], '#111827').toFixed(2),
      'acento-700 sobre acento-50': +contraste(ra[700], ra[50]).toFixed(2),
    },
    rampas: { marca: rm, acento: ra },
  };
}
