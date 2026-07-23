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

  // En escritorio saltamos la landing y vamos directo al login.
  // Si el usuario ya tiene sesión, /auth lo redirige a su panel.
  win.loadURL(`${APP_URL.replace(/\/$/, "")}/auth`);

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

// ------------------------------------------------------------------
// IPC de impresión
// ------------------------------------------------------------------

/**
 * Lista las impresoras del sistema visibles para Electron/Chromium.
 * Se usa desde la pantalla de Configuración para que el usuario elija
 * cuál impresora usar para tickets (80mm) y cuál para facturas carta.
 */
ipcMain.handle("nicapos:list-printers", async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: !!p.isDefault,
    }));
  } catch (e) {
    console.error("[print] listPrinters", e);
    return [];
  }
});

/**
 * Imprime el contenido actual de la ventana.
 * - Si `deviceName` está definido y `silent` es true, imprime sin diálogo.
 * - Si no, abre el diálogo estándar de impresión del sistema.
 */
ipcMain.handle("nicapos:print", async (_evt, opts = {}) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win) return { ok: false, error: "Sin ventana activa" };
  const { deviceName, silent = true, copies = 1 } = opts;
  return await new Promise((resolve) => {
    win.webContents.print(
      {
        silent: silent && !!deviceName,
        deviceName: deviceName || undefined,
        printBackground: true,
        copies: Math.max(1, Number(copies) || 1),
        margins: { marginType: "default" },
      },
      (success, failureReason) => {
        if (!success) resolve({ ok: false, error: failureReason || "Impresión cancelada" });
        else resolve({ ok: true });
      },
    );
  });
});

/**
 * Envía el comando ESC/POS estándar para abrir el cajón monedero.
 * Bytes 27,112,0,25,250 → ESC p 0 25 250 (kick pin 2).
 * Usa OS printing enviando bytes crudos por node:child_process.
 */
ipcMain.handle("nicapos:open-drawer", async (_evt, opts = {}) => {
  const { deviceName } = opts;
  if (!deviceName) return { ok: false, error: "Selecciona la impresora térmica primero" };
  try {
    const { spawn } = require("node:child_process");
    const fs = require("node:fs");
    const os = require("node:os");
    const kick = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    const tmp = path.join(os.tmpdir(), `nicapos-kick-${Date.now()}.bin`);
    fs.writeFileSync(tmp, kick);
    if (process.platform === "win32") {
      // Copia binaria directa al puerto de impresión mapeado en Windows.
      spawn("cmd.exe", ["/c", "copy", "/b", tmp, `\\\\localhost\\${deviceName}`], {
        windowsHide: true,
      });
    } else {
      spawn("lp", ["-d", deviceName, "-o", "raw", tmp]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
