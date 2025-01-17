/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, ipcMain, shell, screen, dialog } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { mainZustandBridge } from 'zutron/main';
import MenuBuilder from './menu';
import { store } from './store/create';
import { resolveHtmlPath } from './util';
import Store from 'electron-store';
import fs from 'fs';
import { pluginManager } from './pluginManager';
import { serviceRegistry } from './serviceRegistry';
import { computerVisionService } from './computerVision';
import { anthropicService } from './store/anthropic'; // Add this import

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')({ showDevTools: false });
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

// Add this function to load plugins
async function loadPlugins() {
  const pluginsDir = path.join(app.getAppPath(), 'src', 'plugins');
  console.log(`Attempting to load plugins from: ${pluginsDir}`);

  if (!fs.existsSync(pluginsDir)) {
    console.log(`Plugins directory does not exist: ${pluginsDir}`);
    return;
  }

  const pluginFiles = fs.readdirSync(pluginsDir);

  for (const file of pluginFiles) {
    if (file.endsWith('.js')) {
      const pluginPath = path.join(pluginsDir, file);
      try {
        const PluginClass = require(pluginPath);
        const plugin = new PluginClass();
        if (typeof plugin.initialize === 'function') {
          plugin.initialize();
        }
        console.log(`Loaded plugin: ${file}`);
      } catch (error) {
        console.error(`Error loading plugin ${file}:`, error);
      }
    }
  }
}

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  // Get the primary display's work area (screen size minus taskbar/dock)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const electronStore = new Store();

  interface WindowState {
    width: number;
    height: number;
    x?: number;
    y?: number;
  }

  const windowState = electronStore.get('windowState', {
    width: 350,
    height: 600,
    x: undefined,
    y: undefined,
  }) as WindowState;

  mainWindow = new BrowserWindow({
    show: false,
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }

    // Load plugins after the window content has loaded
    pluginManager.loadPlugins();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();

  const { unsubscribe } = mainZustandBridge(ipcMain, store, [mainWindow], {
    // reducer: rootReducer,
  });

  app.on('quit', unsubscribe);

  // Add these window control handlers
  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });

  ['resized', 'moved'].forEach((event) => {
    mainWindow?.on(event as any, () => {
      if (mainWindow && !mainWindow.isMaximized()) {
        const bounds = mainWindow.getBounds();
        electronStore.set('windowState', bounds);
      }
    });
  });

  // Add these handlers after the existing IPC handlers
  ipcMain.on('get-plugins', (event) => {
    const plugins = pluginManager.getPlugins();
    event.reply('get-plugins-response', plugins);
  });

  ipcMain.on('install-plugin', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'JavaScript', extensions: ['js'] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      pluginManager.installPlugin(filePath);
      event.reply('install-plugin-response', true);
    } else {
      event.reply('install-plugin-response', false);
    }
  });

  // Add this new IPC handler for services
  ipcMain.on('get-services', (event) => {
    const services = serviceRegistry.getServices();
    log.info(`Sending services to renderer. Count: ${services.length}`);
    event.reply('get-services-response', services);
  });
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Register services
    serviceRegistry.register('computerVision', computerVisionService);
    serviceRegistry.register('anthropic', anthropicService); // Add this line
    log.info('Services registered in whenReady');

    createWindow();
    pluginManager.loadPlugins();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });

    // Add this to log the registered services and their functions
    const registeredServices = serviceRegistry.getAll();
    log.info('Registered services:', registeredServices);

    // Add an IPC handler to get services
    ipcMain.handle('get-services', () => {
      return serviceRegistry.getAll();
    });
  })
  .catch(console.log);
