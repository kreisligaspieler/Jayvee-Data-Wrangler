/* The functions in this file are to create and modify files.
*/

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import sqlite3 from 'sqlite3';

/**
 * Creates a folder inside the workspace directory.
 * If the folder already exists, it thrwos an error. 
 * @param {string} dirName - The name of the folder to be created.
 */
export async function createDirectory(dirName: string): Promise<string> {
    const userDataPath = app.getPath("userData");
    const newFolderPath = path.join(userDataPath, "workspace", dirName);
    if (!fs.existsSync(newFolderPath)) {
        fs.mkdirSync(newFolderPath, { recursive: true });
        return newFolderPath;
    } else {
        throw new Error("Directory already exists.");
    }
}

/**
 * Writes content to a file located at the specified folder path and file name.
 * If the file already exists, it overwrites the existing content with the new content.
 * If the file does not exist, it creates the file with the specified content.
 * @param {string} folderPath - The folder path where the file is located or will be created.
 * @param {string} fileName - The name of the file to which content will be written.
 * @param {string} content - The content to be written to the file.
 */
export async function writeToFile(folderPath: string, fileName: string, content: string): Promise<void> {
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Appends content to a file located at the specified folder path and file name.
 * If the file does not exist, it creates the file with the specified content.
 * @param {string} folderPath - The folder path where the file is located or will be created.
 * @param {string} fileName - The name of the file to which content will be appended.
 * @param {string} content - The content to be appended to the file.
 */
export async function appendToFile(folderPath: string, fileName: string, content: string): Promise<void> {
    const filePath = path.join(folderPath, fileName);
    fs.appendFileSync(filePath, content, 'utf-8');
}

/**
 * Inserts a string into a file between two specified substrings, right before the last occurrence of the last substring.
 * @param {string} folderPath - The folder path where the file is located.
 * @param {string} fileName - The name of the file.
 * @param {string} first - The first substring to search for.
 * @param {string} last - The last substring to search for.
 * @param {string} textToAppend - The text to append after the substring range.
 */
export async function insertIntoFile(folderPath: string, fileName: string, first: string, last: string, textToAppend: string): Promise<void> {
    const filePath = path.join(folderPath, fileName);

    // Read the content of the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Find the position of the first substring
    const firstIndex = fileContent.indexOf(first);

    // Check if the first substring is found
    if (firstIndex === -1) {
        throw new Error(`First substring '${first}' not found in the file.`);
    }

    // Find the position of the second substring after the first substring
    const lastIndex = fileContent.indexOf(last, firstIndex + first.length);

    // Check if the second substring is found after the first substring
    if (lastIndex === -1) {
        throw new Error(`Second substring '${last}' not found after the first substring '${first}'.`);
    }

    // Extract the text between the first and last substrings
    const textBetween = fileContent.substring(firstIndex + first.length, lastIndex);

    // Construct the new content with the appended text
    const newContent = fileContent.substring(0, lastIndex) + textToAppend + fileContent.substring(lastIndex);

    // Write the new content back to the file
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

/**
 * Reads the content of a file, applies Jayvee formatting rules, and writes the formatted content back to the file.
 * @param {string} filePath - The path of the file to be formatted.
 *  @param {string} fileName - Name of the  Jayvee file
 */
export async function formatJayveeProject(filePath: string, fileName: string): Promise<void> {
    try {
        // Read the content of the file
        const fileContent = fs.readFileSync(filePath + "/" + fileName, 'utf-8');

        // Split the content into lines
        const lines = fileContent.split(/(?<=[{};])/);

        // Initialize variables to keep track of indentation
        let indentation = 0;
        let formatedContent = '';
        // Iterate through each line and apply formatting rules
        for (let line of lines) {
            line = line.trim(); // If there are any leading or trailing whitespaces, remove them.
            if (line === '{' || line === '}') {
                // Line break after '{', '}'
                formatedContent += '\n'.repeat(2);
                // Tab before '{', '}'
                formatedContent += '\t'.repeat(indentation) + line;
                // Adjust indentation for the next line
                indentation += line === '{' ? 1 : -1;
            } else if (line.startsWith('block') || line.startsWith('pipe')) {
                // Add a tab before 'block' or 'pipe'
                formatedContent += '\t'.repeat(indentation) + line;
                // Adjust indentation for the next line
                indentation++;
            } else if (line.endsWith(';')) {
                // Line break after ';'
                formatedContent += line + '\n';
            }
        }
    } catch (error) {
        console.error(`Error reading the file: ${(error as Error).message}`);
    }
}

let db: sqlite3.Database | null = null;
let currentDatabasePath: string | null = null;
/** Creates or opens a new database in the workspace directory and inserts or updates the metadata.
 * @param {string} dirName - The name of the folder where the database will be created.
 * @param {string} dataBaseName - The name of the database its metadata will be stored.
 * @param {string} key - The key of the metadata.
 * @param {string} value - The value of the metadata.
 */
export async function storeMetadata(dirName: string, dataBaseName: string, tableName: string, key: string, value: string): Promise<void> {
    const userDataPath = app.getPath("userData");
    const newFolderPath = path.join(userDataPath, "workspace", dirName);
    const newDatabaseName = `${dataBaseName}_metadata`;
    const newDatabasePath = path.join(newFolderPath, `${newDatabaseName}.sqlite`);

    if (currentDatabasePath !== newDatabasePath) {
        if (db) {
            // Close the existing connection if the database path has changed
            await new Promise<void>((resolve, reject) => {
                db?.close((err) => {
                    if (err) {
                        console.error(err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            db = null;
        }

        // Update the current database path
        currentDatabasePath = newDatabasePath;
    }

    if (!db) {
        // Create a new connection if there isn't one
        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            let newDb = new sqlite3.Database(newDatabasePath, (err) => {
                if (err) {
                    console.error(err.message);
                    reject(err);
                } else {
                    resolve(newDb);
                }
            });
        });
    }
    return new Promise<void>((resolve, reject) => {
        db?.serialize(() => {
            db?.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (key TEXT PRIMARY KEY, value TEXT)`, (err) => {
                if (err) {
                    console.error(err.message);
                    reject(err);
                } else {
                    db?.run(`INSERT OR REPLACE INTO "${tableName}" (key, value) VALUES (?, ?)`, [key, value], (err) => {
                        if (err) {
                            console.error(err.message);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

/** Loads metadata from the database in the workspace directory.
 * @param {string} dirName - The name of the folder where the database is located.
 * @param {string} dataBaseName - The name of the database its metadata will be stored.
 * @param {string} key - The key of the metadata to load.
 * @returns {string[]} - The value of the metadata or null if it doesn't exist.
 */
export async function loadMetadata(dirName: string, dataBaseName: string, tableName: string): Promise<{ [key: string]: string }[] | null> {
    return new Promise((resolve, reject) => {
        const userDataPath = app.getPath("userData");
        const newFolderPath = path.join(userDataPath, "workspace", dirName);
        const newDatabaseName = `${dataBaseName}_metadata`;


        // Open a new database connection if one doesn't already exist
        let db = new sqlite3.Database(path.join(newFolderPath, `${newDatabaseName}.sqlite`), (err) => {
            if (err) {
                reject(err.message);
            }
        });


        // Select all records from the table and return them, first get the valuetypes sorted, then the rest
        db.all(`SELECT key, value FROM "${tableName}" WHERE value LIKE '%ValueType%'`, [], (err, valueTypeRows: { key: string, value: string }[]) => {
            if (err) {
                reject(err.message);
                return;
            }

            valueTypeRows.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

            // Select the rest of the records from the table
            db.all(`SELECT key, value FROM "${tableName}" WHERE value NOT LIKE '%ValueType%'`, [], (err, otherRows: { key: string, value: string }[]) => {
                if (err) {
                    reject(err.message);
                } else {
                    otherRows.sort((a, b) => a.key.localeCompare(b.key));
                    resolve([...valueTypeRows, ...otherRows]);
                }
            });
        });
    });
}