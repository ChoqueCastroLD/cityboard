# Commits

- Rama `main`, push directo (`gh` ya está autenticado en el VPS).
- Mensajes en español: título corto en imperativo o descriptivo, línea en blanco, cuerpo con el porqué.
- Terminar con la línea de coautoría del asistente cuando lo hizo él.
- Antes de `git add -A`, revisar `git status --short`: no deben aparecer `.env`, `*.db`, `node_modules`.
- Correr [verificar](verificar.md) antes de pushear cambios de código.

```bash
cd /root/cityboard
git status --short
git add -A && git commit -m "Título" -m "Por qué." && git push origin main
```

El repo es público: nada de claves, tokens, correos personales ni datos del dueño en código, docs ni mensajes.
