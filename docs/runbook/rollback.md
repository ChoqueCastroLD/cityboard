# Rollback

Volver a una versión anterior cuando un despliegue rompe algo.

1. Ver los últimos commits:
   ```bash
   cd /root/cityboard && git log --oneline -10
   ```
2. Volver el checkout al commit bueno **sin perder historia**:
   ```bash
   git revert --no-edit <commit-malo>          # preferido: crea un commit que deshace
   ```
   Si hay prisa y luego se arregla en `main`:
   ```bash
   git checkout <commit-bueno> -- .           # deja los archivos como estaban
   ```
3. Reconstruir y levantar: [desplegar](desplegar.md) desde el paso 3.
4. Si el commit malo cambió el schema y borró datos, restaurar la base: [backup-y-restauracion](backup-y-restauracion.md).
5. Pushear el revert a `main` para que el repo refleje producción: [commits](commits.md).

Las imágenes anteriores no se guardan con etiqueta; el rollback siempre es reconstruir desde código.
