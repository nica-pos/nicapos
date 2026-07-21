// Nica-POS desktop wrapper (Electron).
// Este proceso principal abre una ventana nativa que carga la app web publicada.
// Toda la lógica (POS, ventas, auth, backend) sigue viviendo en la web:
// el escritorio solo aporta ícono, ventana propia y experiencia sin navegador.

const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");

// URL de la app publicada. Cambia esto al dominio final de producción
// (por ejemplo https://nicapos.com) o define APP_URL antes de empaquetar.
const APP_URL =
  process.env.APP_URL ||
  "https://nicapos.lovable.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Nica-POS",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // requerido para cargar preload con require()
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadURL(APP_URL);

  // Abrir enlaces externos (target=_blank) en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Menú minimalista con recargar / salir / devtools
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Archivo",
        submenu: [{ role: "quit", label: "Salir" }],
      },
      {
        label: "Ver",
        submenu: [
          { role: "reload", label: "Recargar" },
          { role: "forceReload", label: "Forzar recarga" },
          { role: "toggleDevTools", label: "Herramientas de desarrollo" },
          { type: "separator" },
          { role: "resetZoom", label: "Zoom normal" },
          { role: "zoomIn", label: "Acercar" },
          { role: "zoomOut", label: "Alejar" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Pantalla completa" },
        ],
      },
    ]),
  );
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
