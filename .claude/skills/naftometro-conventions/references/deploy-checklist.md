# Naftometro — Deploy Checklist

## Pre-deploy (en local, antes de hacer push)

### 1. Bumpear versión en 3 lugares
La versión actual se sigue tipo semver light: `vMAJOR.MINOR` (ej: `v18.14`).

- `app.js` — al inicio del archivo, suele haber un `console.log('Naftometro vX.Y')`. Actualizar.
- `index.html` — buscar `?v=` en el archivo. Hay 2 ocurrencias:
  - `<link rel="stylesheet" href="style.css?v=X.Y">`
  - `<script src="app.js?v=X.Y"></script>`
- `sw.js` — `const CACHE_NAME = 'naftometro-vX.Y'`

**Si se olvida cualquiera de los 3, los usuarios siguen viendo la versión vieja** (el SW cachea agresivo).

### 2. Probar en local
- Abrir `index.html` en el navegador (puede usarse `python3 -m http.server` o similar)
- Probar el flujo afectado en mobile (iOS Safari es el más crítico — tiene quirks)
- Verificar que no haya errores en consola

### 3. Si tocaste SQL
- Ejecutar la migración primero en Supabase dashboard (SQL Editor)
- Verificar que las RLS policies funcionen con un usuario no-owner
- El SQL queda commiteado en el repo aunque ya esté aplicado (es documentación)

## Deploy

```bash
git add .
git commit -m "vX.Y: descripción corta del cambio"
git push origin main
```

Vercel auto-deploya. Tarda ~30-60s.

## Post-deploy

### 1. Verificar en prod
- Abrir https://naftometro.vercel.app/ en navegador
- Verificar que el `console.log` de versión sea el nuevo
- Hard refresh (Cmd+Shift+R) si la PWA muestra versión vieja

### 2. Verificar que el SW se actualizó
- DevTools → Application → Service Workers
- Debe aparecer la versión nueva como "activated and is running"
- Si quedó stuck en la vieja: "Unregister" y refresh

### 3. Si era una migración SQL
- Verificar en Supabase Dashboard → Logs que no haya errores
- Probar la feature como usuario común (no como dueño del proyecto)

## Si algo sale mal

### Rollback
1. `git revert <commit-hash>` y push → Vercel redeploya la versión anterior
2. Si la migración SQL rompió algo: hay que escribir migración de reversión (Supabase no soporta rollback automático)

### Cache problemático
Si los usuarios reportan que "no se actualiza":
- Confirmar que se bumpeó la versión en los 3 lugares
- Pedirles cerrar la app PWA completamente y reabrir
- En último caso, agregar logica `skipWaiting()` + `clients.claim()` en el SW (ya está en el código actual pero a veces hay que reforzarlo)

## Versionado: ¿cuándo es MAJOR vs MINOR?

No es estricto, pero como guía:
- **MAJOR** (v18 → v19): cambio de schema importante, refactor grande, feature nueva grande
- **MINOR** (v18.13 → v18.14): bug fix, ajuste de UI, feature chica

No se usa PATCH (tercer número) en este proyecto.
