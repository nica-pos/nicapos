# Nica-POS — Instalador de escritorio (un solo clic)

Este directorio contiene el envoltorio de escritorio (Electron). La app web publicada sigue siendo la fuente de verdad; Electron abre una ventana nativa que la carga (sin barra del navegador, con ícono propio).

El instalador se genera con **electron-builder** en modo **NSIS one-click**: el usuario descarga **un solo archivo `.exe`**, doble clic → se instala solo → crea acceso directo en el escritorio y en el menú Inicio → abre la app.

## 1) Instalar dependencias (una sola vez, en tu máquina local)

```bash
npm install
```

Ya están declaradas `electron` y `electron-builder` en `devDependencies`.

## 2) Probar la app en modo desarrollo

```bash
npm run electron:dev
```

Se abrirá una ventana con Nica-POS cargando desde `https://nicapos.lovable.app`.

## 3) Generar el instalador de un solo clic

### Windows (`.exe` único — recomendado)

```bash
npm run electron:installer:win
```

Resultado: `electron-release/Nica-POS-Setup-1.0.0.exe` — **un solo archivo**. El usuario:

1. Lo descarga.
2. Doble clic.
3. Se instala solo (sin preguntas), crea acceso directo y abre la app.

### macOS (`.dmg`)

```bash
npm run electron:installer:mac
```

Resultado: `electron-release/Nica-POS-1.0.0.dmg` — arrastrar a Aplicaciones.

### Linux (`.AppImage`)

```bash
npm run electron:installer:linux
```

Resultado: `electron-release/Nica-POS-1.0.0.AppImage` — dar permisos de ejecución y correr.

## Ícono

El ícono `electron/icon.png` (1024×1024) se usa para:

- La ventana de la app.
- El instalador (`.exe`).
- El acceso directo en el escritorio.
- El desinstalador.

Para reemplazarlo, sustituye `electron/icon.png` por otro PNG cuadrado (mínimo 512×512, ideal 1024×1024). electron-builder genera automáticamente los tamaños `.ico`/`.icns` necesarios.

## Cómo funciona internamente

- El proceso principal (`electron/main.cjs`) abre un `BrowserWindow` que hace `loadURL('https://nicapos.lovable.app')`.
- Toda la lógica (POS, ventas, auth, backend) vive en la web — no se duplica nada.
- Actualizaciones automáticas: cuando publicas cambios en Lovable, los usuarios los ven al reiniciar la app. **No hace falta reinstalar.**
- El instalador se conserva pequeño (~80 MB) porque no incluye el código fuente ni `node_modules` del bundle web.

## Configuración

Toda la configuración del empaquetado vive en `electron-builder.yml` en la raíz del proyecto. Ajustable: nombre, versión, íconos, atajos, permisos NSIS, categoría, etc.
