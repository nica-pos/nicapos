// Preload de Electron: expone una API mínima y segura al proceso web (renderer).
// Con contextIsolation activo, el renderer no accede a Node; solo a este puente.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nicaposDesktop", {
  /** Marca que la app corre dentro del instalador de escritorio. */
  isDesktop: true,

  /**
   * Devuelve la lista de impresoras instaladas en el sistema.
   * @returns {Promise<Array<{name: string, displayName: string, isDefault: boolean}>>}
   */
  listPrinters: () => ipcRenderer.invoke("nicapos:list-printers"),

  /**
   * Imprime la vista actual de la ventana usando la impresora indicada.
   * Si no se pasa deviceName, abre el diálogo estándar del sistema.
   * @param {{ deviceName?: string, silent?: boolean, copies?: number }} opts
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  print: (opts) => ipcRenderer.invoke("nicapos:print", opts ?? {}),

  /**
   * Envía comando ESC/POS para abrir el cajón de dinero conectado a la térmica.
   * Requiere impresora térmica con salida de cajón (RJ11/RJ12).
   * @param {{ deviceName: string }} opts
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  openCashDrawer: (opts) => ipcRenderer.invoke("nicapos:open-drawer", opts ?? {}),
});
