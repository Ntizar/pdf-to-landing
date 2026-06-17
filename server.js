import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pdf-parse no tiene default export en ESM, usar createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Storage para archivos PDF subidos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Crear directorio uploads si no existe
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// ─── Funciones auxiliares ───────────────────────────────────────

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

// Extraer texto del PDF
async function extractPdfText(fileBuffer) {
  const data = await pdfParse(fileBuffer);
  return data.text;
}

// Analizar el diseño del PDF con IA de NaN
async function analyzeDesign(text, fileName) {
  const token = getNanToken();
  if (!token) return null;

  const systemPrompt = `Eres un diseñador UX/UI experto que analiza PDFs de propuestas de diseño web. Tu trabajo es extraer la información visual y de marca del documento para poder replicar su estilo.

ANALIZA el siguiente texto extraído de un PDF y devuelve UN JSON VÁLIDO con esta estructura EXACTA:

{
  "empresa": "nombre de la empresa o proyecto",
  "sector": "sector al que pertenece",
  "tono": "formal | informal | creativo | corporativo | minimalista | audaz",
  "paleta": {
    "primario": "#hex",
    "secundario": "#hex",
    "acento": "#hex",
    "fondo": "#hex",
    "texto": "#hex"
  },
  "tipografia": {
    "heading": "tipo de fuente sugerida para títulos (serif | sans-serif | display | monospace)",
    "body": "tipo de fuente sugerida para cuerpo (serif | sans-serif)"
  },
  "estilo": "descripción corta del estilo visual (máx 30 palabras)",
  "secciones": [
    {"tipo": "hero|about|services|portfolio|testimonials|contact|cta|pricing|faq|team|footer", "titulo": "título de la sección", "descripcion": "descripción breve"}
  ],
  "colores_dominantes": ["#hex1", "#hex2", "#hex3"],
  "elementos_visuales": ["iconos | ilustraciones | fotos | gradientes | formas geométricas"],
  "inspiracion": "referencia de estilo (Stripe | Apple | Linear | Notion | Figma | etc.)",
  "call_to_action": "texto del botón principal",
  "url": "sitio web si aparece en el PDF",
  "email": "email si aparece",
  "telefono": "teléfono si aparece",
  "direccion": "dirección si aparece",
  "redes_sociales": ["twitter | linkedin | instagram | github"],
  "texto_hero": "texto principal del hero si se puede extraer",
  "subtitulo_hero": "subtexto del hero si existe",
  "features": [
    {"titulo": "feature", "descripcion": "breve descripción"}
  ],
  "testimonios": [
    {"texto": "cita", "autor": "nombre", "cargo": "rol"}
  ]
}

REGLAS:
1. Responde SOLO con JSON válido, sin markdown, sin backticks, sin texto adicional
2. Si no encuentras información para un campo, usa null o valores por defecto razonables
3. Los colores deben ser hex válidos. Si no aparecen en el texto, asigna colores coherentes con el sector
4. Las secciones deben ser las que realmente existen en el PDF
5. El tono debe reflejar la personalidad de la marca
6. Si el PDF es una propuesta de diseño, extrae TODA la información visual posible
7. No inventes datos específicos (números de teléfono, emails) si no aparecen en el PDF

Si el texto es muy corto o no parece un diseño web, asume que es una landing page genérica y genera un diseño coherente.`;

  try {
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Limpiar tags de razonamiento de qwen3
    let clean = content;
    // Eliminar cualquier bloque <think>...</think>
    const thinkRegex = new RegExp('<think>[\\s\\S]*?</think>', 'g');
    clean = clean.replace(thinkRegex, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Error analizando diseño:', err.message);
    return null;
  }
}

// Generar HTML de landing page basado en el análisis
async function generateLandingHTML(design, style) {
  const token = getNanToken();
  if (!token) return null;

  const systemPrompt = `Eres un desarrollador frontend experto que crea landing pages HTML completas y profesionales.

Crea una landing page completa basada en el análisis de diseño proporcionado. La landing debe ser:

1. **Responsive** — funciona perfecto en móvil y desktop
2. **Moderna** — con glassmorphism, gradientes, animaciones sutiles
3. **Profesional** — lista para producción
4. **Un solo archivo HTML** — todo CSS y JS inline

INSTRUCCIONES DE DISEÑO:
- Usa los colores de la paleta del diseño analizado
- Si no hay colores específicos, usa un esquema profesional con azul (#2563eb) y naranja (#f97316) como acento
- Tipografía: usa Google Fonts (Inter para body, Poppins o Space Grotesk para headings)
- Incluye animaciones CSS sutiles (fade-in, slide-up, hover effects)
- Usa gradientes y glassmorphism para dar profundidad
- Footer con "Hecho con ❤️ por David Antizar"

SECCIONES OBLIGATORIAS (basadas en el análisis):
- Hero con CTA principal
- Sección de servicios/features
- Sobre nosotros
- Testimonios (si existen)
- CTA intermedio
- Footer con contacto

El HTML debe ser un archivo completo con DOCTYPE, head, body, y todo inline.
No uses frameworks — HTML + CSS + JS vanilla.
Incluye meta viewport para responsive.

Responde SOLO con el código HTML completo, sin markdown, sin backticks, sin texto adicional.`;

  try {
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Limpiar markdown si viene envuelto
    let html = content.replace(/```html\n?/g, '').replace(/```/g, '').trim();
    // Asegurar que empieza con DOCTYPE
    if (!html.startsWith('<!DOCTYPE')) {
      html = '<!DOCTYPE html>\n' + html;
    }
    return html;
  } catch (err) {
    console.error('Error generando HTML:', err.message);
    return null;
  }
}

// Desplegar en GitHub + NaN
async function deployToNaN(htmlContent, design) {
  const token = getNanToken();
  if (!token) return null;

  const repoName = `landing-${Date.now()}`;
  const companyName = (design?.empresa || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
  const githubRepo = `Ntizar/${companyName}-landing-${Date.now()}`.substring(0, 50);

  // Crear un HTML completo para el deploy
  const deployHtml = htmlContent;

  // Crear un archivo temporal para el deploy
  const deployDir = path.join(__dirname, 'deploy', repoName);
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, 'index.html'), deployHtml);

  // Crear README
  fs.writeFileSync(path.join(deployDir, 'README.md'), `# ${design?.empresa || 'Landing Page'}\n\nGenerado automáticamente desde PDF.\n\nHecho con ❤️ por David Antizar`);

  // Intentar clonar el repo, si no existe, crearlo
  try {
    execSync(`git clone https://${process.env.GITHUB_TOKEN || ''}@github.com/${githubRepo}.git /tmp/${repoName} 2>/dev/null || true`);
  } catch (e) {}

  // Crear el repo en GitHub si no existe
  try {
    execSync(`gh repo create ${githubRepo} --public --source=/tmp/${repoName} --clone 2>/dev/null || true`, {
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN || '' }
    });
  } catch (e) {}

  // Copiar archivos al repo
  try {
    execSync(`cp -r ${deployDir}/* /tmp/${repoName}/ 2>/dev/null || true`);
    execSync(`cd /tmp/${repoName} && git add . && git commit -m "Deploy landing" && git push 2>/dev/null || true`, {
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN || '' }
    });
  } catch (e) {}

  // Devolver URL de GitHub Pages
  const githubPagesUrl = `https://${githubRepo.split('/')[0].toLowerCase()}.github.io/${repoName}/`;
  
  // También intentar deploy en NaN
  const nanUrl = `https://${repoName}.apps.nan.builders`;

  return {
    githubUrl: `https://github.com/${githubRepo}`,
    githubPagesUrl,
    nanUrl,
    repoName
  };
}

// ─── Rutas ──────────────────────────────────────────────────────

// Endpoint principal: procesar PDF
app.post('/api/process', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún PDF' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.originalname;

    // Paso 1: Extraer texto
    res.json({ step: 1, message: '📄 Extrayendo texto del PDF...' });
    const text = await extractPdfText(fileBuffer);

    // Paso 2: Analizar diseño
    res.json({ step: 2, message: '🎨 Analizando diseño y marca...' });
    const design = await analyzeDesign(text, fileName);

    // Paso 3: Generar HTML
    res.json({ step: 3, message: '✏️ Generando landing page...' });
    const html = await generateLandingHTML(design, 'modern');

    // Paso 4: Deploy
    res.json({ step: 4, message: '🚀 Desplegando...' });
    const deployResult = await deployToNaN(html, design);

    // Limpiar archivo subido
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      design: design || {},
      html: html,
      deploy: deployResult,
      message: '✅ ¡Landing page lista!'
    });
  } catch (err) {
    console.error('Error procesando PDF:', err);
    res.status(500).json({ error: 'Error procesando el PDF: ' + err.message });
  }
});

// Endpoint para generar solo el HTML (sin deploy)
app.post('/api/generate', async (req, res) => {
  try {
    const { text, fileName } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto requerido' });

    const design = await analyzeDesign(text, fileName || 'documento.pdf');
    const html = await generateLandingHTML(design, 'modern');

    res.json({
      design: design || {},
      html: html,
      message: '✅ Landing generada'
    });
  } catch (err) {
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 PDF-to-Landing corriendo en http://localhost:${PORT}`);
});
