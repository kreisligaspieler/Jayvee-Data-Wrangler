import { app, BrowserWindow, ipcMain, dialog, shell, screen } from "electron";
import * as path from "path";
import { createNewProject, cleanup } from "./src/dataWrangler/csv_import";
import sqlite3 from 'sqlite3';
import * as helper from './src/dataWrangler/helpers';


let mainWindow: BrowserWindow | null;
let db: sqlite3.Database;
function createWindow() {
  // Get the primary display's size
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window with screen size
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
    },
  });
  mainWindow.setMenu(null);



  // Load the startpage of the app.
  mainWindow.loadFile(path.join(__dirname, "src", "app.html"));
 
  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On macOS, re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});


// Routing to open new pages
ipcMain.on("newProject", () => {
  mainWindow?.loadURL(
    `file://${path.join(__dirname, "src", "newProject", "newProject.html")}`
  );
});

// Routing to open already existing projects
ipcMain.on("loadProject", async (event) => {
  // The UI has to be cleaned up, e.g. remove HTML Elements from previous imports or reset variables
  await cleanup();
  await mainWindow?.loadURL(
    `file://${path.join(__dirname, "src", "loadProject", "loadProject.html")}`
  );
});

// Routing to open the help page
ipcMain.on("help", () => {
  mainWindow?.loadURL(
    `file://${path.join(__dirname, "src", "help", "help.html")}`
  );
});

// Routing to view database
ipcMain.on("viewDatabase", (event, [databasePath, tableName]) => {
  mainWindow?.loadURL(
    `file://${path.join(__dirname, "src", "viewDatabase", "viewDatabase.html")}?databasePath=${encodeURIComponent(databasePath)}&tableName=${encodeURIComponent(tableName)}`
  );
});

// Routing to open new pages
ipcMain.on("home", () => {
  mainWindow?.loadURL(
    `file://${path.join(__dirname, "src", "app.html")}`
  );
});

ipcMain.handle("getPath", (event, name) => {
  return app.getPath(name);
});


// Start the process of creating a new project.
ipcMain.on('createNewProject', async (event) => {
  try {
    // The UI has to be cleaned up, e.g. remove HTML Elements from previous imports or reset variables
    await cleanup();
    await createNewProject();
  } catch (error) {
    // Send error back to the renderer process
    throw new Error((error as Error).message);
  }
});

// Connect to a database and load data
ipcMain.on('connectToDatabase', (event, databasePath) => {
  db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
      console.error(err.message);
    }
  });
});

// Fetch all data from a sqlite database
ipcMain.handle('dbAll', async (event, sqlQuerry) => {
  return new Promise((resolve, reject) => {
    db.all(sqlQuerry, (err, rows) => {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

// Fetch data from a sqlite database row by row
ipcMain.on('dbEach', (event, sqlQuerry) => {
  db.each(sqlQuerry, (err, row) => {
    event.reply('dbEachRow', row);
  }, (err, count) => {
    event.reply('dbEachComplete');
  });
});

// Listen for the 'show-error-dialog' event from the renderer process
ipcMain.on('show-error-dialog', (event, message) => {
  // Show an error dialog with the specified message
  dialog.showErrorBox('Error', message);
});

// Open the folder when receiving a message from the renderer process
ipcMain.on('open-folder', (event, folderPath) => {
  shell.openPath(folderPath);
});

// Searches all the folders in the workspace.
ipcMain.handle('getFoldersInWorkspace', (event) => {
  return helper.getFoldersInWorkspace();
});

export { mainWindow }