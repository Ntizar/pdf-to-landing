# v8 — Dos motores de diseño (2026-10-25)

## Qué cambió y por qué

David: *«De esto no me gusta que todo sea Aurora. Creo que debería dar más opciones,
por ejemplo que el programa use openui para escribir la web y sea el propio modelo
el que dé distintos formatos en función de lo que busque el usuario.»*

Antes: 5 plantillas fijas. Cinco PDFs distintos daban cinco webs que se parecían
demasiado. El diagnóstico era correcto.

Ahora: **el modelo compone**. Dos motores:

- **Libre (OpenUI, por defecto)** — el modelo escribe un programa `openui-lang` con
  los 36 componentes del sistema. Elige estructura, orden, jerarquía y densidad.
- **Composición fija** — bloques del sistema en un orden probado (5 plantillas).
  Red de seguridad.

En los dos el CSS es Aurora y la página pasa el mismo validador.

## Medición que justificó el cambio

Mismo PDF (Fairground), 5 estilos, modo libre:

| Estilo | Nodos | Comp. | Primitivas elegidas |
|---|---|---|---|
| Corporativo | 45 | 13 | cluster + botones, tabla, KPI |
| Editorial | 42 | 13 | split + stack (dos columnas) |
| Producto | 30 | 13 | **dash-grid + kpi** |
| Cálido | 40 | 14 | cluster + etiqueta |
| Técnico | 32 | 14 | split + tabla |

**5 estructuras distintas de 5**, y las cinco con 0 fallos en el lint de Aurora.

## Decisiones técnicas que costaron medirlas

1. **El runtime de OpenUI es un IIFE de navegador**, pero se puede usar en Node:
   se carga con `vm` en un contexto con `fetch` (sirve la spec desde disco) e
   `import` que rechaza (fuerza el parser local). `pintar(programa, null)` no toca
   DOM y devuelve el HTML como cadena. Sin red, determinista.

2. **Los packs NO se mapean a mano.** El primer intento fue un mapa
   `componente → pack` y `Nota` apuntaba a `p17` cuando su clase vive en `p6`; el
   auditor lo cazó a la primera. Ahora se derivan del HTML ya compilado con el
   censo: si la clase existe, su pack se enlaza.

3. **Validar argumentos y TIPOS es imprescindible.** El modelo se salta opcionales
   y cambia tipos. Tres bugs reales, los tres vistos en página:
   - `DosColumnas([...], "60-40")` → **«60-40» impreso** como contenido
   - `Boton(..., true)` → clase **`.nz-btn--true`**
   - `Tarjeta(..., "true")` → booleano entrecomillado

   La spec del repo (`aurora.spec.json`) trae `enum`, `required` y `type` por
   componente: con eso se valida y se da feedback exacto al modelo.

4. **El presupuesto de color se ajusta sobre el PROGRAMA**, no parcheando el HTML.
   El modelo ponía 9 elementos de marca y 5 de acento. Ahora: se conserva el tono
   en el primero de cada tipo y el resto se apaga, usando un valor que EXISTA en el
   enum de ese componente (`Cifra` no tiene «neutro»: ahí se quita el argumento si
   es el último).

5. **La marca va en el CSS después de `tokens.css`.** `[data-nz-marca="x"]` y
   `:root` tienen la misma especificidad: gana la última regla. Con el `<link>` de
   la marca antes, el color elegido **no se veía nunca**.

6. **El prompt necesita reglas de conversión explícitas.** Sin ellas el modelo
   ponía el CTA enterrado y usaba «Footer» como título de sección («Footer»
   aparecía como titular visible). También hay que decirle que traduzca al
   castellano aunque el documento esté en inglés.

## Verificación

`node arnes.mjs` → **86 comprobaciones**. Criterio: cero fallos de lint
(obligatorio) y máximo 2 avisos, que es lo que saca la propia receta oficial de
landing de Aurora.

## Despliegue

- Commit `620ba8a` → `origin/main`.
- NaN app 115: build `5589` succeeded, imagen `620ba8a`, **autoDeploy sí
  promocionó** (a diferencia de las versiones anteriores, que se quedaron clavadas
  en `5a851e8`).
- Verificado en producción: `/api/motores` responde con `openuiListo: true`,
  generación real en modo libre (34 nodos, 22 s) y la página pasa el lint.

**Pitfall nuevo:** Cloudflare devuelve **403 a `urllib` y a curl sin User-Agent**.
Hay que pedir con UA de navegador para verificar una vista servida.
