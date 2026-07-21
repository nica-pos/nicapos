# Nica-POS — App de escritorio (Electron)

Este directorio contiene el envoltorio de escritorio. La app web publicada sigue siendo la fuente de verdad; Electron solo abre una ventana nativa que la carga (sin barra del navegador, con ícono propio, instalador `.exe` / `.dmg` / `.AppImage`).

## 1) Publicar la web primero

En Lovable pulsa **Publish** para tener una URL estable (`https://tu-app.lovable.app` o tu dominio propio).

Luego edita `electron/main.cjs` y reemplaza `APP_URL` por esa URL de producción.

## 2) Instalar dependencias (una sola vez, en tu máquina local)

```bash
npm install --save-dev electron @electron/packager
```

## 3) Probar la app de escritorio en modo desarrollo

```bash
npx electron electron/main.cjs
```

Se abrirá una ventana con tu Nica-POS cargando desde la URL pública.

## 4) Empaquetar instaladores

### Windows (.exe portable)
```bash
npx @electron/packager . "Nica-POS" \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/supabase' \
  --ignore='^/electron-release'
```
Resultado: `electron-release/Nica-POS-win32-x64/Nica-POS.exe`

### macOS (.app)
```bash
npx @electron/packager . "Nica-POS" \
  --platform=darwin --arch=universal \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/supabase' \
  --ignore='^/electron-release'
```

### Linux (AppImage / tar)
```bash
npx @electron/packager . "Nica-POS" \
  --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/supabase' \
  --ignore='^/electron-release'
```

## Ícono personalizado

Coloca `electron/icon.png` (512×512 recomendado). Para Windows usa `.ico` y para macOS `.icns`, y pasa `--icon=electron/icon.ico` al comando de packager.

## Cómo funciona internamente

- El proceso principal (`electron/main.cjs`) crea un `BrowserWindow` que hace `loadURL(APP_URL)`.
- Toda la lógica (auth, ventas, inventario, superadmin) vive en la web — no se duplica nada.
- Los usuarios inician sesión igual que en el navegador; la sesión persiste en el perfil de Electron.
- Actualizaciones: cuando publicas cambios en Lovable, los usuarios los ven al reiniciar la app (o pulsar Ver → Recargar). No hace falta reinstalar.
