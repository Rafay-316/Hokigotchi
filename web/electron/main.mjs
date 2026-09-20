import { app, BrowserWindow, dialog, session } from "electron";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Development launcher: keep the Next.js server running in another terminal.
const APP_URL = "http://localhost:3000";

// Resolve the original profile before renaming so local progress survives.
app.setName("FORK");
const savedUserData = app.getPath("userData");
const savedSessionData = app.getPath("sessionData");
mkdirSync(savedUserData, { recursive: true });
mkdirSync(savedSessionData, { recursive: true });
app.setPath("userData", savedUserData);
app.setPath("sessionData", savedSessionData);
app.setName("Hokigotchi");

function keepNavigationInApp(event, destination) {
  try {
    if (new URL(destination).origin === APP_URL) return;
  } catch {
    // Invalid URLs are blocked too.
  }
  event.preventDefault();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    title: "Hokigotchi",
    backgroundColor: "#f7f2e9",
    icon: fileURLToPath(new URL("../public/hokigotchi.png", import.meta.url)),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) window.show();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", keepNavigationInApp);
  window.webContents.on("will-redirect", keepNavigationInApp);

  void window.loadURL(APP_URL).catch(() => {
    if (window.isDestroyed()) return;

    dialog.showErrorBox(
      "Hokigotchi could not connect",
      "Start the Next.js server from your web folder:\n\n" +
        "npm.cmd run dev -- --port 3000\n\n" +
        "Wait for Ready, then run npm.cmd run desktop again."
    );
    window.destroy();
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.fork.desktop.dev");
  }

  // The current dashboard needs no camera, microphone, or device permissions.
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(() => {
  dialog.showErrorBox("Hokigotchi could not start", "Close Hokigotchi and run npm.cmd run desktop again.");
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
