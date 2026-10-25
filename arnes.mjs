// ─────────────────────────────────────────────────────────────────────────────
// arnes.mjs — Arneses de verificación del proyecto (Node puro, sin dependencias)
//
//   node arnes.mjs              → todo
//   node arnes.mjs lint         → los 5 ejemplos contra el lint de Aurora
//   node arnes.mjs marcas       → las rampas coinciden con las del repo
//   node arnes.mjs descarga     → el HTML descargado es autocontenido y válido
//   node arnes.mjs paletas      → la heurística de color acierta
//   node arnes.mjs servidor     → endpoints en vivo (requiere el servidor arriba)
//
// Sale 0 solo si todo está en verde. Es el recibo de que esto funciona.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import { createRequire } from 'module';
import * as A from './src/aurora.mjs';
import * as M from './src/marca.mjs';
import * as B from './src/bloques.mjs';
import * as G from './src/generador.mjs';
import * as E from './src/ejemplos.mjs';

const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://localhost:3000';

const SALTO = String.fromCharCode(10);
let fallos = 0;
let pruebas = 0;
const ok = (cond, texto, detalle = '') => {
  pruebas++;
  if (!cond) fallos++;
  console.log(`  ${cond ? '✓' : '✗'} ${texto}${detalle ? ' · ' + detalle : ''}`);
};

// ── 1. El lint de Aurora sobre los cinco ejemplos ────────────────────────────
function lint() {
  console.log('\n[1] Los cinco formatos pasan el lint de Aurora');
  for (const e of E.todos()) {
    const v = A.validar(e.html);
    // 0 FALLOS es obligatorio. En AVISOS el techo es el de la receta oficial de
    // landing del propio Aurora (medida: 2 avisos); igualarlo ya es ir por delante.
    const TOPE_AVISOS = 2;
    ok(v.fallos.length === 0 && v.avisos.length <= TOPE_AVISOS,
      `${e.formato} (${e.nombrePlantilla})`,
      `${e.bloques.length} bloques · ${e.packs.length} packs · ${v.fallos.length} fallos · ${v.avisos.length} avisos`);
    if (v.fallos.length) console.log('     ', v.fallos);
    if (v.avisos.length) console.log('      avisos:', v.avisos);
  }
  // y que las cinco plantillas sean de verdad distintas
  const ordenes = new Set(E.todos().map((e) => e.bloques.join('>')));
  ok(ordenes.size === 5, 'las cinco composiciones son distintas entre sí', `${ordenes.size} órdenes únicos`);
}

// ── 2. Las rampas de marca coinciden con el repo de Aurora ───────────────────
function marcas() {
  console.log('\n[2] Las rampas OKLCH coinciden con las del repo');
  const oficiales = JSON.parse(fs.readFileSync(new URL('./data/marcas-oficiales.json', import.meta.url), 'utf8'));
  let iguales = 0;
  let comparados = 0;
  for (const o of oficiales) {
    const g = M.generarMarca(o.nombre, o.marca_original || o.marca, o.acento);
    let difs = 0;
    for (const [k, v] of Object.entries(o.marca_rampa)) if (g.rampas.marca[k].toLowerCase() !== v.toLowerCase()) difs++;
    for (const [k, v] of Object.entries(o.acento_rampa)) if (g.rampas.acento[k].toLowerCase() !== v.toLowerCase()) difs++;
    comparados++;
    if (!difs) iguales++;
    else console.log(`     ${o.nombre}: ${difs} paso(s) distinto(s)`);
  }
  ok(iguales === comparados, 'rampas idénticas para las marcas oficiales', `${iguales}/${comparados}`);
  // y que el contraste AA se cumple
  const g = M.generarMarca('prueba', '#0d9488', '#ea580c');
  ok(g.contraste['blanco sobre marca-600'] >= 4.5, 'el color de marca cumple AA sobre blanco', `${g.contraste['blanco sobre marca-600']}:1`);
}

// ── 3. La descarga es autocontenida y válida ─────────────────────────────────
function descarga() {
  console.log('\n[3] El HTML descargado se sostiene solo');
  const casos = E.todos().map((e) => ({ nombre: e.slug, html: e.html, paleta: { nombre: e.marca.nombre, color: e.marca.color, acento: e.marca.acento } }));
  const gen = G.componer({
    contenido: { empresa: 'Prueba', cta: 'Ir', hero: { titulo: 'Hola' }, cifras: { items: [{ etiqueta: 'A', valor: '1' }] } },
    design: {}, plantilla: 'clasica',
    paletas: [{ nombre: 'marca', marca: '#008479', acento: '#ea580c', descripcion: 'x', contraste: {} }],
  });
  casos.push({ nombre: 'variante del PDF', html: gen.variantes[0].html, paleta: { nombre: 'marca', color: '#008479', acento: '#ea580c' } });

  for (const c of casos) {
    const css = M.generarMarca(c.paleta.nombre, c.paleta.color, c.paleta.acento).css;
    const html = c.html.split(/<link rel="stylesheet" href="\/marca\/[^"]*">/).join(`<style>\n${css}\n</style>`);
    const v = A.validar(html);
    ok(v.fallos.length === 0 && !/\/marca\//.test(html) && html.includes('[data-nz-marca='),
      c.nombre, `${(html.length / 1024).toFixed(1)} KB · fallos ${v.fallos.length}`);
    if (v.fallos.length) console.log('     ', v.fallos);
  }
}

// ── 4. La heurística del color del PDF ───────────────────────────────────────
function paletas() {
  console.log('\n[4] Del color del PDF a la paleta');
  const casos = [
    { nombre: 'tres verdes y un naranja', colores: ['#2E7D32', '#F7931A', '#81C784', '#1B5E20'], esperaMarcaCerca: '#1b5e20' },
    { nombre: 'teal del PDF', colores: ['#0d9488', '#ea580c', '#134e4a', '#ccfbf1'], esperaMarcaCerca: '#008479' },
    { nombre: 'sin colores utilizables', colores: ['#ffffff', '#111827', '#e5e7eb'], esperaMarcaCerca: null },
  ];
  for (const c of casos) {
    const p = G.proponerPaletas(c.colores.map((hex) => ({ hex })));
    ok(p.length === 3, `${c.nombre}: da tres paletas distintas`,
      p.map((x) => `${x.marca}/${x.acento}`).join(' '));
    const distintas = new Set(p.map((x) => `${x.marca}|${x.acento}`));
    ok(distintas.size === p.length, `${c.nombre}: ninguna repetida`);
    if (c.esperaMarcaCerca) {
      ok(p[0].marca.toLowerCase() === c.esperaMarcaCerca, `${c.nombre}: la marca es la familia dominante`, p[0].marca);
    }
  }
}

// ── 5. Composición: reglas duras propias ─────────────────────────────────────
function composicion() {
  console.log('\n[5] Reglas de composición');
  for (const e of E.todos()) {
    const h = e.html;
    ok((h.match(/<h1[\s>]/g) || []).length === 1, `${e.slug}: un solo <h1>`);
    ok(!/[\u{1F300}-\u{1FAFF}]/u.test(h.replace('❤️', '')), `${e.slug}: sin emojis en la interfaz`);
    ok(!/gradient/i.test(h), `${e.slug}: sin gradientes`);
    ok(h.includes('Hecho con ❤️ por David Antizar'), `${e.slug}: con la atribución exacta`);
    ok(/data-nz-theme="(light|dark)"/.test(h) && /<body class="nz"/.test(h), `${e.slug}: cabecera y body del sistema`);
  }
}

// ── 6. El servidor en vivo ───────────────────────────────────────────────────
async function servidor() {
  console.log(`\n[6] Servidor en vivo (${BASE})`);
  const get = async (ruta) => {
    const r = await fetch(BASE + ruta);
    return { estado: r.status, cuerpo: await r.text() };
  };
  try {
    const est = await get('/api/estado');
    ok(est.estado === 200, 'GET /api/estado responde');
    const datos = JSON.parse(est.cuerpo);
    ok(datos.version === A.AURORA.version, 'el servidor usa la misma versión de Aurora', datos.version);

    const aur = JSON.parse((await get('/api/aurora')).cuerpo);
    ok(aur.clases > 2000, 'el censo de clases está cargado', `${aur.clases} clases`);

    const ej = JSON.parse((await get('/api/ejemplos')).cuerpo);
    ok(ej.ejemplos.length === 5 && ej.plantillas.length === 5, 'los cinco formatos se listan');

    for (const e of ej.ejemplos) {
      const r = await get(e.url);
      ok(r.estado === 200 && /class="nz/.test(r.cuerpo), `la vista de ${e.slug} se sirve`, `${r.estado} · ${(r.cuerpo.length / 1024).toFixed(1)} KB`);
      const m = r.cuerpo.match(/<link rel="stylesheet" href="\/marca\/[^"]*">/);
      ok(Boolean(m), `${e.slug}: la vista declara su marca`);
    }

    // el CSS de marca responde y con el color pedido
    const css = await get('/marca/prueba.css?c=%23008479&a=%23ea580c');
    ok(css.estado === 200 && css.cuerpo.includes('#008479'), 'la rampa de marca se genera en caliente');

    // errores honestos
    const sinPdf = await fetch(BASE + '/api/generar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    ok(sinPdf.status === 400, 'sin PDF responde 400 con mensaje', String(sinPdf.status));
    const noExiste = await get('/api/no-existe');
    ok(noExiste.estado === 404, 'ruta desconocida de API responde 404');
    const r404 = await fetch(BASE + '/ruta-inventada');
    const cuerpo404 = await r404.text();
    ok(r404.status === 404 && /text\/html/.test(r404.headers.get('content-type') || '') && /Hecho con/.test(cuerpo404),
      'una ruta de página da un 404 con HTML del sistema', `${r404.status} ${r404.headers.get('content-type')}`);
  } catch (e) {
    ok(false, 'servidor alcanzable', e.message);
  }
}

// ── 7. El orden de las hojas de estilo ───────────────────────────────────────
// El bug caro: la marca antes de tokens.css → misma especificidad, gana la última.
function hojas() {
  console.log('\n[7] Orden de las hojas y presencia de la marca');
  for (const e of E.todos()) {
    const iTokens = e.html.indexOf('tokens.css');
    const iMarca = e.html.indexOf('/marca/');
    ok(iMarca > iTokens && iTokens > 0, `${e.slug}: la marca se enlaza después de tokens.css`);
    const packs = [...A.packsNecesarios(e.html)];
    const enlazados = [...A.packsEnlazados(e.html)];
    const faltan = packs.filter((p) => !enlazados.includes(p));
    ok(faltan.length === 0, `${e.slug}: todos los packs usados están enlazados`, faltan.join(',') || 'ninguno falta');
  }
}


// ── 8. OpenUI: el motor libre ───────────────────────────────────────────────
// No llama al modelo (eso cuesta y no es determinista): comprueba que el
// compilador, el validador de argumentos y el presupuesto de color funcionan.
async function openui() {
  console.log(SALTO + '[8] Motor libre (OpenUI)');
  const M = await import('./src/openui.mjs');
  await M.iniciar();
  ok(M.catalogo().length === 36, 'el catálogo trae los 36 componentes', String(M.catalogo().length));
  ok(M.modo() === 'local' || M.modo() === 'oficial', 'el parser arranca', M.modo());

  // un programa mínimo compila a HTML del sistema
  const r = await M.compilar(['root = Pagina([t, p])', 't = Titular("Hola", "1")', 'p = Texto("Un párrafo.")'].join(SALTO));
  ok(r.ok && /nz-h1/.test(r.html), 'un programa mínimo compila a clases de Aurora', `${r.nodos} nodos`);

  // las cinco plantillas del repo compilan
  const fs = await import('fs');
  const dir = new URL('./src/openui/plantillas/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    const t = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
    const prog = t.programa.replace(/\{\{[a-z]+\}\}/g, 'Ejemplo');
    const v = M.validarPrograma(prog);
    const c = await M.compilar(prog);
    ok(v.ok && c.ok, `plantilla ${t.nombre || f} compila`, `${c.nodos} nodos`);
  }

  // el validador de argumentos caza el opcional saltado y el enum inválido
  const malo = ['root = Pagina([b])', 'b = Boton("Ir", "primario", true)'].join(SALTO);
  const errs = M.validarArgumentos(malo);
  ok(errs.length > 0, 'caza un opcional saltado (el .nz-btn--true)', errs[0] || '');
  const rep = M.repararPrograma(malo);
  ok(rep.cambios.length > 0 && M.validarArgumentos(rep.programa).length === 0, 'lo repara sin tocar el diseño');

  const enumMalo = ['root = Pagina([k])', 'k = Kpi("A", "1", "", "plano", "exito")'].join(SALTO);
  ok(M.validarArgumentos(enumMalo).length > 0, 'caza un enum que no existe en ese componente');

  // el presupuesto de color se ajusta sobre el programa
  const colorinche = ['root = Pagina([a, b, c])', 'a = Kpi("A", "1", "", "plano", "marca")', 'b = Kpi("B", "2", "", "plano", "marca")', 'c = Kpi("C", "3", "", "plano", "marca")'].join(SALTO);
  const pc = M.ajustarPresupuestoColor(colorinche);
  ok(pc.cambios.length > 0, 'baja el exceso de color sin tocar el HTML', pc.cambios[0] || '');

  // los packs se derivan del HTML real, no de un mapa a mano
  const packs = M.packsDe(r.html);
  ok(packs.length > 0 && packs.every((x) => x.startsWith('packs/')), 'los packs salen del HTML con su ruta', packs.join(' '));
}

const grupos = { lint, marcas, descarga, paletas, composicion, servidor, hojas, openui };
const pedido = process.argv[2];
const aCorrer = pedido ? [pedido] : Object.keys(grupos);
for (const g of aCorrer) {
  if (!grupos[g]) { console.log('Grupo desconocido:', g); process.exit(2); }
  await grupos[g]();
}

console.log(`\n${fallos ? '✗' : '✓'} ${pruebas - fallos}/${pruebas} comprobaciones en verde${fallos ? ` · ${fallos} FALLOS` : ''}`);
process.exit(fallos ? 1 : 0);
