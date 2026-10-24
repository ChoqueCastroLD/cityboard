# QA visual

Pruebas en navegador real con los contenedores browserless del VPS.

## Preparar

1. Token y puerto de un browserless:
   ```bash
   NAME=$(docker ps --format '{{.Names}}' | grep browserless | head -1)
   TOKEN=$(docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^TOKEN=//p')
   PORT=$(docker port "$NAME" 3000/tcp | head -1 | cut -d: -f2)
   ```
2. Una partida en curso: [partida-de-prueba](partida-de-prueba.md).

## Script

Guarda un módulo como `qa.js`, en una carpeta fuera del repo:

```js
export default async function ({ page }) {
  const out = { errores: [], fallidas: [] };
  page.on('pageerror', (e) => out.errores.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && out.errores.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && out.fallidas.push(`${r.status()} ${r.url()}`));

  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument((s) => {
    localStorage.setItem('capi:session', JSON.stringify(s));
    localStorage.setItem('capi:board-view', '2d');
  }, { gameId: 'ID', playerId: 'PLAYER_ID', secret: 'SECRET' });
  await page.goto('https://capichan.com/monopoly/room/ID', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 5000));

  out.imagenesRotas = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  out.captura = await page.screenshot({ type: 'png', encoding: 'base64' });
  return { data: out, type: 'application/json' };
}
```

Ejecutar y guardar la captura:

```bash
curl -s -X POST "http://127.0.0.1:$PORT/function?token=$TOKEN" \
  -H 'Content-Type: application/javascript' --data-binary @qa.js -o qa.json
python3 -I -c "import json,base64; d=json.load(open('qa.json'))['data']; open('qa.png','wb').write(base64.b64decode(d.pop('captura'))); print(d)"
```

Si `qa.json` no es JSON, es el mensaje de error del script.

## Qué revisar

- Viewports: 1440×900, 834×1112 y 390×844 (`isMobile: true, hasTouch: true`).
- Sin errores de consola, sin respuestas 4xx/5xx, sin imágenes rotas, sin desborde horizontal.
- 2D: casillas con imagen, banderas, dados al centro, ficha que salta casilla a casilla, zoom con `page.mouse.wheel`, arrastre con `mouse.down/move/up`.
- Abrir hoja de casilla, ajustes, chat, "Ver al jugador" (clic en chip, luego en la opción).
- Cambiar a 3D y volver (botón con `aria-label` que contiene "Tablero 2D" o "Tablero 3D").

## Límites conocidos

- Tooltips: el navegador reporta `hover: none` y la app los oculta. Verificar a mano.
- 3D: no llega a `networkidle2`; usar `domcontentloaded` y una espera fija, o mirar los logs de `capi-web` buscando 4xx.
- Pellizco: se simula enviando `PointerEvent` de dos `pointerId` sobre el elemento `.touch-none`.
