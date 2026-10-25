// Prueba real: el mismo negocio con DOS estilos distintos → ¿salen webs distintas?
import fs from 'fs';
import { construir, ESTILOS } from '../src/openui-generador.mjs';
const TOKEN = fs.readFileSync(process.env.LOCALAPPDATA + '/hermes/cache/scratch/nan_api.txt', 'utf8').trim();
const design = {
  empresa: 'Clínica Aravaca Dental', sector: 'Clínica dental', publico: 'familias del barrio, 30-55 años',
  tono: 'cercano', titulo_hero: 'Entras con una duda, sales con un plan', subtitulo_hero: 'Diagnóstico completo en la primera visita, con presupuesto escrito.',
  cta: 'Pedir cita', datos_clave: ['primera visita gratis', 'garantía 10 años en implantes', '24 meses sin intereses', '2 480 pacientes'],
};
const texto = 'Tratamientos: implantes con cirugía guiada, ortodoncia invisible, estética dental, urgencias el mismo día. Precios: revisión 0 €, implante 1 190 €, ortodoncia 2 400 €. Horario L-V 9-21, S 9-14. Dirección Avenida de Aravaca 14.';
const marca = { nombre: 'esmeralda', marca: '#008479', acento: '#ea580c' };
const estilo = process.env.ESTILO || 'producto';
const t0 = Date.now();
const r = await construir({ token: TOKEN, design, texto, estilo, tema: process.env.TEMA || 'claro', marca });
console.log(`\n=== ESTILO ${estilo} · ${Date.now()-t0} ms · intentos ${r.intentos} ===`);
console.log('ok:', r.ok, '| nodos:', r.nodos, '| componentes:', Object.keys(r.componentes).length);
console.log('errores:', r.errores.length ? r.errores : 'ninguno');
console.log('avisos:', r.avisos.length ? r.avisos : 'ninguno');
console.log('componentes:', Object.keys(r.componentes).join(', '));
if (r.ok) {
  fs.writeFileSync(`capturas/estilo-${estilo}.html`, r.html);
  fs.writeFileSync(`capturas/prog-${estilo}.txt`, r.programa);
  console.log('escrito capturas/estilo-' + estilo + '.html', r.html.length, 'bytes');
}
