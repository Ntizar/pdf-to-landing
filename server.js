import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pdf-parse no tiene default export en ESM, usar createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes ANTES de static para evitar captura
app.post('/api/analyze', upload.single('pdf'), handleAnalyze);
app.post('/api/generate', handleGenerate);

app.use(express.static(path.join(__dirname, 'public')));

// Storage para archivos PDF subidos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Crear directorios si no existen
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// ─── Token ──────────────────────────────────────────────────────
function getNanToken() {
  if (process.env.NAN_API) return process.env.NAN_API;
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^NAN_API=(.+)$/m);
    if (match) return match[1].trim();
  } catch (e) {}
  return '';
}

// ─── Extracción de texto ────────────────────────────────────────
async function extractPdfText(fileBuffer) {
  const data = await pdfParse(fileBuffer);
  return data.text;
}

// ─── Análisis de diseño con IA ──────────────────────────────────
async function analyzeDesign(text, fileName) {
  const token = getNanToken();
  if (!token) throw new Error('Token de NaN API no configurado');

  const systemPrompt = `Eres un diseñador UX/UI experto que analiza PDFs de propuestas de diseño web.
Analiza el texto extraído y devuelve UN JSON VÁLIDO con esta estructura:
{
  "empresa": "nombre de la empresa o proyecto",
  "sector": "sector al que pertenece",
  "tono": "formal | informal | creativo | corporativo | minimalista | audaz",
  "paleta": { "primario": "#hex", "secundario": "#hex", "acento": "#hex", "fondo": "#hex", "texto": "#hex" },
  "tipografia": { "heading": "serif | sans-serif | display | monospace", "body": "serif | sans-serif" },
  "estilo": "descripción corta del estilo visual (máx 30 palabras)",
  "secciones": [ {"tipo": "hero|about|services|portfolio|testimonials|contact|cta|pricing|faq|team|footer", "titulo": "título", "descripcion": "descripción breve"} ],
  "colores_dominantes": ["#hex1", "#hex2", "#hex3"],
  "elementos_visuales": ["iconos | ilustraciones | fotos | gradientes | formas geométricas"],
  "inspiracion": "referencia de estilo (Stripe | Apple | Linear | Notion | Figma | etc.)",
  "call_to_action": "texto del botón principal",
  "url": "sitio web si aparece en el PDF",
  "texto_hero": "texto principal del hero",
  "subtitulo_hero": "subtexto del hero",
  "features": [ {"titulo": "feature", "descripcion": "breve descripción"} ],
  "testimonios": [ {"texto": "cita", "autor": "nombre", "cargo": "rol"} ]
}
REGLAS:
1. Responde SOLO con JSON válido, sin markdown, sin backticks
2. Si no hay info para un campo, usa null o valores por defecto razonables
3. Los colores deben ser hex válidos
4. No inventes datos específicos si no aparecen en el PDF`;

  const response = await fetch('https://api.nan.builders/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'qwen3.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analiza este PDF: ${fileName}\n\nTexto extraído:\n${text.substring(0, 8000)}` }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error API NaN: ${response.status} ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Limpiar tags <think> de qwen3
  let clean = content;
  const thinkRegex = new RegExp('<think>[\\\\s\\\\S]*?</think>', 'g');
  clean = clean.replace(thinkRegex, '').trim();

  // Extraer JSON (puede estar envuelto en ```json)
  const jsonMatch = clean.match(/```json\\n?([\\s\\S]*?)```/) || [null, clean];
  return JSON.parse(jsonMatch[1].trim());
}

// ─── Generación de HTML ─────────────────────────────────────────
async function generateLandingHTML(design) {
  const token = getNanToken();
  if (!token) throw new Error('Token de NaN API no configurado');

  const systemPrompt = `Eres un desarrollador frontend experto que crea landing pages HTML profesionales.
Crea una landing page completa basada en el análisis de diseño proporcionado.
REQUISITOS:
1. Responsive (móvil + desktop)
2. Moderna (glassmorphism, gradientes, animaciones CSS sutiles)
3. Un solo archivo HTML con todo inline (CSS + JS)
4. Google Fonts: Inter para body, Space Grotesk para headings
5. Footer: "Hecho con ❤️ por David Antizar"
6. Usar los colores de la paleta del diseño
7. Incluir: Hero con CTA, servicios/features, sobre nosotros, testimonios si existen, CTA intermedio, footer
8. NO usar frameworks — HTML + CSS + JS vanilla
9. Animaciones fade-in al scroll con IntersectionObserver

Responde SOLO con el HTML completo, sin markdown, sin backticks.`;

  const response = await fetch('https://api.nan.builders/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'qwen3.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera la landing page para: ${JSON.stringify(design, null, 2)}` }
      ],
      max_tokens: 8000,
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error API NaN: ${response.status} ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Limpiar markdown wrapping
  let html = content.replace(/```html\\n?/g, '').replace(/```/g, '').trim();
  if (!html.startsWith('<!DOCTYPE')) {
    html = '<!DOCTYPE html>\\n' + html;
  }
  return html;
}

// ─── Handlers ───────────────────────────────────────────────────
async function handleAnalyze(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún PDF' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.originalname;

    // Extraer texto
    const text = await extractPdfText(fileBuffer);

    // Analizar diseño
    const design = await analyzeDesign(text, fileName);

    // Limpiar archivo temporal
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({ success: true, design });
  } catch (err) {
    console.error('Error en /api/analyze:', err);
    // Limpiar archivo en caso de error
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: err.message || 'Error analizando el PDF' });
  }
}

async function handleGenerate(req, res) {
  try {
    const { design } = req.body;
    if (!design) {
      return res.status(400).json({ error: 'Datos de diseño requeridos' });
    }

    const html = await generateLandingHTML(design);

    res.json({ success: true, html });
  } catch (err) {
    console.error('Error en /api/generate:', err);
    res.status(500).json({ error: err.message || 'Error generando la landing' });
  }
}

// ─── Health Check ───────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PDF-to-Landing v2 corriendo en http://localhost:${PORT}`);
});
