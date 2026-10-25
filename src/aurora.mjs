// ─────────────────────────────────────────────────────────────────────────────
// aurora.mjs — Listón determinista para las landing pages generadas.
//
// El modelo NO decide si su HTML está bien: lo decide esto. Portado de
// scripts/auditar-uso.py del repo Ntizar/Aurora (PASO 0: el repo manda) y
// ampliado con reparaciones deterministas para las faltas que se pueden
// arreglar sin volver a llamar al modelo.
//
// Reglas duras (FALLO):  clase inventada · pack que falta · gradiente ·
// backdrop-filter · !important · emoji fuera de la atribución · más de un <h1>
// Avisos  (AVISO):  color a mano · desktop-first · escala tipográfica ·
// jerarquía · presupuesto de color · superficies anidadas · sombra a mano
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CENSO = JSON.parse(fs.readFileSync(path.join(__dirname, 'aurora-censo.json'), 'utf8'));

export const AURORA = {
  version: CENSO.version,
  cdn: CENSO.cdn,
  packs: CENSO.packs,
  clases: CENSO.clases,
};

export const ATRIBUCION = 'Hecho con ❤️ por David Antizar';
const EXENTAS = new Set(['nz', 'nz-visually-hidden', 'nz-vh', 'nz-print-hide']);

const RE_CLASE = /class="([^"]*)"/g;
const RE_STYLE_INLINE = /style="([^"]*)"/g;
const RE_STYLE_BLOCO = /<style[^>]*>([\s\S]*?)<\/style>/gi;
// Pictogramas. Los símbolos tipográficos (✓ ✕ → …) NO cuentan.
const RE_EMOJI = /[\u{1F000}-\u{1FAFF}\u2600-\u26FF\u2700-\u27BF\u{2B00}-\u{2BFF}\uFE0F]/gu;
const TIPOGRAFICOS = new Set(['\u2713', '\u2715', '\u2717', '\u2794', '\u279C', '\u2192', '\u2190', '\u2191', '\u2193']);
const RE_COLOR_MOMENTO = /nz-(?:btn|cta|badge|chip|lbl|kpi|alert)(?:--(?:primary|accent|brand|success|warning|danger|info))/g;
const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RE_RGB = /\b(?:rgb|rgba|hsl|hsla)\(/g;
const RE_FONT_PX = /font-size\s*:\s*(\d+(?:\.\d+)?)px/g;
const RE_PESO = /font-weight\s*:\s*(\d{3})\b/g;
const RE_TOKEN_TEXTO = /var\((--nz-text-(?:2xs|xs|sm|base|md|lg|xl|2xl|3xl|4xl))\)/g;

const quitarComentarios = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
const esMuestraDeCodigo = (h) => h.replace(/(<(pre|code|textarea)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (m, a, t, _, c) => a + c);

// ── Censo ────────────────────────────────────────────────────────────────────
export function packDe(clase) {
  return CENSO.clases[clase] || null;
}

export function packsNecesarios(html) {
  const limpio = esMuestraDeCodigo(html);
  const packs = new Set();
  for (const m of limpio.matchAll(RE_CLASE)) {
    for (const c of m[1].split(/\s+/)) {
      const p = CENSO.clases[c];
      if (p) packs.add(p);
    }
  }
  return packs;
}

export function packsEnlazados(html) {
  const packs = new Set();
  for (const m of html.matchAll(/href="https:\/\/cdn\.jsdelivr\.net\/gh\/Ntizar\/Aurora@([^/"]+)\/([^"]+)"/g)) {
    packs.add(m[2]);
  }
  return packs;
}

// ── Validación ───────────────────────────────────────────────────────────────
export function validar(html) {
  const fallos = [];
  const avisos = [];
  const muestra = esMuestraDeCodigo(quitarComentarios(html));
  const enlazados = packsEnlazados(muestra);

  // 1 · clases
  const vistas = new Set();
  for (const m of muestra.matchAll(RE_CLASE)) {
    for (const c of m[1].split(/\s+/)) if (c) vistas.add(c);
  }
  const nz = [...vistas].filter((c) => c.startsWith('nz-'));
  for (const c of nz) {
    if (!CENSO.clases[c] && !EXENTAS.has(c)) fallos.push(`clase inventada: .${c} no existe en Aurora`);
  }
  for (const c of [...vistas]) {
    if (c.startsWith('cat-') || c.startsWith('demo-')) fallos.push(`clase del shell del catálogo: .${c}`);
  }

  // 2 · packs
  if (enlazados.size) {
    const necesarios = packsNecesarios(muestra);
    for (const p of necesarios) {
      if (!enlazados.has(p)) fallos.push(`falta por enlazar el pack ${p}`);
    }
    if (enlazados.has('packs/all.css') && necesarios.size === 0) {
      avisos.push('all.css enlazado sin clases del sistema: peso muerto');
    }
  } else {
    avisos.push('no enlaza el CSS de Aurora');
  }
  for (const v of muestra.matchAll(/Aurora@([^/"]+)\//g)) {
    if (v[1] === 'master') avisos.push('CDN sin pinear (@master)');
  }

  // 3 · manifiesto dentro de <style> y style=""
  const bloques = [...muestra.matchAll(RE_STYLE_BLOCO)].map((m) => m[1]).join(' ');
  const inline = [...muestra.matchAll(RE_STYLE_INLINE)].map((m) => m[1]).join(' ');
  for (const [nombre, texto] of [['<style>', bloques], ['style=""', inline]]) {
    if (!texto) continue;
    if (/gradient/i.test(texto)) fallos.push(`gradiente en ${nombre}: prohibido por el manifiesto`);
    if (/backdrop-filter/i.test(texto)) fallos.push(`backdrop-filter en ${nombre}: prohibido por el manifiesto`);
    if (/!important/.test(texto)) fallos.push(`!important en ${nombre}: prohibido por el manifiesto`);
    const hex = texto.match(RE_HEX);
    if (hex) avisos.push(`${hex.length} color(es) hex a mano: usa var(--nz-*)`);
    if (RE_RGB.test(texto)) avisos.push('color rgb/hsl a mano: usa var(--nz-*)');
  }
  if (/@media[^{]*max-width/.test(bloques)) avisos.push('@media (max-width): Aurora es mobile-first (min-width)');

  // 4 · composición
  const cuerpo = html.split(ATRIBUCION).join('');
  const emojis = [...cuerpo.matchAll(RE_EMOJI)].map((m) => m[0]).filter((c) => !TIPOGRAFICOS.has(c));
  if (emojis.length) fallos.push(`emoji en la interfaz (${[...new Set(emojis)].join(' ')}): usa .nz-icon`);
  const h1 = (muestra.match(/<h1[\s>]/g) || []).length;
  if (h1 > 1) fallos.push(`${h1} <h1> en la página: debe haber exactamente uno`);
  const momentos = (muestra.match(RE_COLOR_MOMENTO) || []).length;
  if (momentos > 5) avisos.push(`presupuesto de color: ${momentos} elementos con color saturado (máx 5)`);
  const marca = (muestra.match(/nz-\w+--(?:primary|brand)/g) || []).length;
  const acento = (muestra.match(/nz-\w+--accent/g) || []).length;
  if (marca && !acento) avisos.push('acento ausente: el acento marca el dato que importa');
  else if (marca >= 2 && acento >= 2) avisos.push(`dos protagonistas: ${marca} de marca y ${acento} de acento compiten`);
  const chicos = [...new Set((muestra.match(RE_FONT_PX) || []).map((v) => parseFloat(v.replace(/\D/g, ''))))].filter((v) => v < 13);
  if (chicos.length) avisos.push(`tipografía por debajo de 13px: ${chicos.map((v) => v + 'px').join(', ')}`);
  const tamanos = [...new Set((muestra.match(RE_TOKEN_TEXTO) || []))];
  if (tamanos.length > 4) avisos.push(`escala tipográfica: ${tamanos.length} tamaños distintos (máx 4)`);
  const pesos = [...new Set((muestra.match(RE_PESO) || []).filter((w) => w === '700' || w === '800'))];
  if (pesos.length) avisos.push(`font-weight ${pesos.join(', ')} a mano: usa var(--nz-peso-*)`);
  if (tieneSuperficieAnidada(muestra)) avisos.push('superficie dentro de superficie: aplana la caja interior');

  // 5 · estructura y atribución
  if (!/<html[^>]*lang="es"/.test(html)) avisos.push('<html> sin lang="es"');
  if (!/<html[^>]*data-nz-theme="(light|dark)"/.test(html)) avisos.push('<html> sin data-nz-theme');
  if (!/<body[^>]*class="[^"]*\bnz\b/.test(html)) avisos.push('<body> sin class="nz"');
  if (!html.includes(ATRIBUCION)) avisos.push('falta la atribución exacta');

  return { fallos, avisos, ok: fallos.length === 0 };
}

function tieneSuperficieAnidada(html) {
  const pila = [];
  let anidadas = false;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)\b[^>]*>/g)) {
    const [, cierre, tag] = m;
    if (cierre) {
      // la pila guarda objetos: hay que buscar por el nombre de la etiqueta
      for (let i = pila.length - 1; i >= 0; i--) {
        if (pila[i].tag === tag) { pila.splice(i, 1); break; }
      }
      continue;
    }
    if (['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'use', 'path', 'rect', 'circle'].includes(tag)) continue;
    const esSuperficie = /class="[^"]*\bnz-(article|bento)\b/.test(m[0]);
    if (esSuperficie) {
      if (pila.some((t) => t.superficie)) anidadas = true;
      pila.push({ tag, superficie: true });
    } else {
      pila.push({ tag, superficie: false });
    }
  }
  return anidadas;
}

// ── Reparación determinista ──────────────────────────────────────────────────
// Solo se arregla lo que no cambia el diseño: packs que faltan, manifiesto,
// etiquetas repetidas y emojis. El resto se devuelve al modelo como feedback.
export function reparar(html) {
  const cambios = [];
  let out = html;

  // packs que faltan
  const necesarios = packsNecesarios(out);
  const enlazados = packsEnlazados(out);
  const faltan = [...necesarios].filter((p) => !enlazados.has(p)).sort();
  if (faltan.length) {
    const etiquetas = ['tokens.css', ...faltan]
      .map((f) => `  <link rel="stylesheet" href="${AURORA.cdn}${f}">`)
      .join('\n');
    if (/<\/head>/i.test(out)) {
      out = out.replace(/\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/Ntizar\/Aurora@[^"]*"[^>]*>\s*/gi, '\n');
      out = out.replace(/<\/head>/i, `${etiquetas}\n</head>`);
    }
    cambios.push(`+ ${faltan.length} pack(s): ${faltan.join(', ')}`);
  }

  // manifiesto dentro de <style>
  out = out.replace(RE_STYLE_BLOCO, (bloque) => {
    let b = bloque;
    if (/gradient/i.test(b)) {
      b = b.replace(/[^{};]*background[^;}]*gradient[^;}]*;?/gi, '');
      cambios.push('− gradiente');
    }
    if (/backdrop-filter/i.test(b)) {
      b = b.replace(/[^{};]*backdrop-filter[^;}]*;?/gi, '');
      cambios.push('− backdrop-filter');
    }
    if (/!important/.test(b)) {
      b = b.replace(/\s*!important/g, '');
      cambios.push('− !important');
    }
    return b;
  });
  out = out.replace(RE_STYLE_INLINE, (m, estilo) => {
    if (!/gradient|backdrop-filter|!important/i.test(estilo)) return m;
    let s = estilo
      .replace(/[^;]*gradient[^;]*;?/gi, '')
      .replace(/[^;]*backdrop-filter[^;]*;?/gi, '')
      .replace(/\s*!important/g, '');
    cambios.push('− manifiesto en style=""');
    return `style="${s.replace(/;\s*$/, '')}"`;
  });

  // emojis fuera de la atribución
  const trozos = out.split(ATRIBUCION);
  let quitados = 0;
  for (let i = 0; i < trozos.length; i++) {
    trozos[i] = trozos[i].replace(RE_EMOJI, (c) => {
      if (TIPOGRAFICOS.has(c)) return c;
      quitados++;
      return '';
    });
  }
  if (quitados) {
    out = trozos.join(ATRIBUCION);
    cambios.push(`− ${quitados} emoji(s)`);
  }

  // <h1> de más → el 2º y siguientes pasan a párrafo con el mismo look
  let vistos = 0;
  out = out.replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, (m, attrs = '', cuerpo) => {
    vistos++;
    if (vistos === 1) return m;
    const c = /class="([^"]*)"/.exec(attrs || '');
    const clase = c ? c[1] : 'nz-h2';
    cambios.push('− <h1> duplicado');
    return `<p class="${/\bnz-(h1|h2|h3|display)\b/.test(clase) ? clase : 'nz-h2'}">${cuerpo}</p>`;
  });

  // cabecera del sistema
  if (!/<html[^>]*lang="es"/.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html lang="es" data-nz-theme="light"$1>');
    cambios.push('+ lang=es y tema');
  } else if (!/<html[^>]*data-nz-theme/.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html data-nz-theme="light"$1>');
    cambios.push('+ data-nz-theme');
  }
  if (!/<body[^>]*class="[^"]*\bnz\b/.test(out)) {
    out = out.replace(/<body([^>]*)>/i, (m, a = '') =>
      /class="/.test(a) ? `<body${a.replace(/class="([^"]*)"/, 'class="$1 nz"')}>` : `<body class="nz"${a}>`);
    cambios.push('+ body.nz');
  }
  return { html: out, cambios };
}

// ── Envoltorio obligatorio (el modelo solo escribe el <body>) ────────────────
export function envolver(cuerpo, { titulo = 'Landing page', error = false } = {}) {
  const packs = [...packsNecesarios(cuerpo)].sort();
  const enlaces = ['tokens.css', ...packs]
    .map((f) => `<link rel="stylesheet" href="${AURORA.cdn}${f}">`)
    .join('\n  ');
  return `<!DOCTYPE html>
<html lang="es" data-nz-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
  ${enlaces}
  <style>
    /* cuerpo base del sistema (tokens): nada de color a mano */
    body { background: var(--nz-bg); color: var(--nz-text); }
    main { display: block; }
  </style>
</head>
<body class="nz">
${cuerpo}
<footer class="nz-footer nz-footer--compact">
  ${error ? 'Vista de ejemplo · ' : ''}${ATRIBUCION}
</footer>
</body>
</html>
`;
}

export function escapar(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
