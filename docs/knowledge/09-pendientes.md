# Pendientes

Por prioridad.

## Técnicos

1. **IP real detrás de Cloudflare**: los límites usan el primer valor de `x-forwarded-for`, que el cliente puede falsear. Usar `CF-Connecting-IP` cuando exista.
2. **Coste del tick**: parsea todas las partidas activas cada segundo. Filtrar por partidas que necesiten tick o cachear el estado parseado.
3. **Service worker viejo en la raíz**: navegadores que visitaron el juego cuando vivía en `/` lo tienen instalado. Se borra al visitar `/monopoly`; el proyecto de la raíz debería servir un `/sw.js` que se desregistre solo.
4. Layout shift en tablet y titulares de eventos largos.

## Bloqueados por claves o decisiones del dueño

- Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`): sin esto no hay suscripción CEO ni fichas premium.
- TURN para la voz: sin él parte de los usuarios no se oyen.
- Tenor (`TENOR_API_KEY`): GIFs solo por enlace pegado.
- Iconos de la PWA y assets de anime: siguen los originales.

## Del dueño

- Probar el chat de voz entre dos personas reales (la señalización está verificada).
- Pasar el ratón por casillas y fichas en 2D para confirmar los tooltips (no se pueden probar en headless).
