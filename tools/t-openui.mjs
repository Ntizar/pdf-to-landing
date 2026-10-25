import fs from 'fs';
const TOK = fs.readFileSync(process.env.LOCALAPPDATA + '/hermes/cache/scratch/nan_api.txt', 'utf8').trim();
const PROMPT = fs.readFileSync('src/openui/PROMPT.md', 'utf8');
const SISTEMA = `${PROMPT}

## Contexto de esta generación
Vas a producir UNA landing page para el negocio de abajo. Responde SOLO con el programa
openui-lang completo, empezando por \`root = Pagina([...])\`. Sin markdown, sin \`\`\`, sin
explicaciones antes ni después.`;

const usuario = `Negocio: Clínica dental Aravaca (Madrid). Servicios: implantes, ortodoncia invisible, estética dental, urgencias el mismo día.
Público: familias del barrio, 30-55 años. Tono: cercano y profesional.
Datos reales: primera visita gratis, garantía 10 años en implantes, financiación 24 meses sin intereses, 2 480 pacientes activos.
Precios: revisión 0 €, implante 1 190 €, ortodoncia 2 400 €.
OBJETIVO: que el visitante pida cita.
Estilo pedido: CORPORATIVO — sobrio, mucho dato, densidad compacta, sin aire de más.
Escribe el programa.`;

const t0 = Date.now();
const r = await fetch('https://api.nan.builders/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOK}` },
  body: JSON.stringify({ model: 'qwen3.6', messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: usuario }], max_tokens: 6000, temperature: 0.5, enable_thinking: false, chat_template_kwargs: { enable_thinking: false } }),
});
const d = await r.json();
const m = d.choices?.[0]?.message || {};
console.log(`http ${r.status} · ${Date.now()-t0} ms · tokens ${JSON.stringify(d.usage)}`);
console.log('razonamiento:', (m.reasoning_content||'').length, 'car');
const prog = String(m.content||'').trim();
fs.writeFileSync('/tmp/prog-openui.txt', prog);
console.log('--- programa (primeras 25 líneas) ---');
console.log(prog.split('\n').slice(0,25).join('\n'));
console.log('--- líneas totales:', prog.split('\n').length);
