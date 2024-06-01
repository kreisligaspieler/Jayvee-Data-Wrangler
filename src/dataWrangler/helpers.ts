/* This file contains useful helper functions. It includes all functions that do not directly affect the Jayvee Pipeline.*/
import fs from 'fs';
import csv from 'csv-parser';
import axios from 'axios';
import * as readline from 'readline';
import * as path from 'path';
import { app } from 'electron';


/**
 * Renames duplicates in an array by adding an underscore and a current number 
 * @param {string[]} arr - The array to be modified
 * @returns {Promise<boolean>} A promise that reolves with true if duplicates were found and renamed.
 */
export async function renameDuplicates(arr: string[]): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {

        const columnCount: { [key: string]: number } = {};
        const duplicateIndices: { [key: string]: number[] } = {};

        let duplicates = false;

        // Iterate through each value in the array
        for (let i = 0; i < arr.length; i++) {
            const value = arr[i];

            // If the value already exists in the count object, it's a duplicate
            if (columnCount.hasOwnProperty(value)) {
                duplicates = true;

                // If it's the first occurrence of this specific duplicate, rename it with _1
                if (duplicateIndices.hasOwnProperty(value)) {
                    const firstOccurrenceIndex = duplicateIndices[value][0];
                    arr[firstOccurrenceIndex] = `${value}_1`;
                    duplicateIndices[value] = [firstOccurrenceIndex, i]; // Update the array with the current index
                }

                // Increment the count for this value
                columnCount[value]++;

                // Rename the current duplicate value with an underscore and the current count
                arr[i] = `${value}_${columnCount[value]}`;

                // Add the current index to the list of occurrences for this duplicate
                duplicateIndices[value].push(i);
            } else {
                // If it's the first occurrence, initialize the count to 1
                columnCount[value] = 1;
                duplicateIndices[value] = [i]; // Initialize the array with the current index
            }
        }
        resolve(duplicates);
    });
}

/**
 * Map chardet encoding to Node.js encoding and check if it's supported by Jayvee.
 * @param {string} chardetEncoding - The encoding detected by chardet.
 * @returns {string} The corresponding Node.js encoding.
 */
export function mapAndCheckEncoding(chardetEncoding: string): string | null {
    //format it for Jayvee
    chardetEncoding = chardetEncoding.replace(/-/g, '').toLowerCase();
    const supportedEncodings: { [key: string]: string | null } = {
        'utf8': 'utf8',
        'ibm866': 'ibm866',
        'iso88592': 'latin2',
        'iso88593': 'latin3',
        'iso88594': 'latin4',
        'iso88595': 'cyrillic',
        'iso88596': 'arabic',
        'iso88597': 'greek',
        'iso88598': 'hebrew',
        'logical': 'logical',
        'iso885910': 'latin6',
        'utf16': 'utf16',
        'latin2': 'latin2',
        'latin3': 'latin3',
        'latin4': 'latin4',
        'cyrillic': 'cyrillic',
        'arabic': 'arabic',
        'greek': 'greek',
        'hebrew': 'hebrew',
        'latin6': 'latin6'
    };
    return supportedEncodings[chardetEncoding] || null;
}

/**
 * Extracts the filename from a URL.
 * @param {string} url - The url of our file.
 * @returns {string | null} The filename extracted from the URL pointing to the file.
 */
export function getFilenameFromURL(url: string): string {
    const lastSlashIndex = url.lastIndexOf('/');
    const filenameWithExtension = url.substring(lastSlashIndex + 1); // Get the part after the last "/"
    const dotIndex = filenameWithExtension.indexOf('.');
    if (dotIndex === -1) {
        return filenameWithExtension;
    }
    return filenameWithExtension.substring(0, dotIndex); // Get the part before the file extension 
}

/**
 * Creates a mapping from column headers to Excel-style column letters.
 * @param {string[]} headers - An array of column headers.
 * @returns {Record<number, string>} - A mapping object where keys are then indices of the header values and values are Excel-style column letters.
 */
export function createHeaderLetterMapping(headers: string[]): Record<number, string> {
    const mapping: Record<number, string> = {};
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let i = 0; i < headers.length; i++) {
        let letter = '';
        let temp = i;
        while (temp >= 0) {
            letter = letters.charAt(temp % letters.length) + letter;
            temp = Math.floor(temp / letters.length) - 1;
        }
        mapping[i] = letter;
    }

    return mapping;
}

/**
 * Checks if a given string is a valid regular expression.
 * @param {string} input - The string to check.
 * @returns {boolean} - True if the input string is a valid regular expression, false otherwise.
 */
export function checkIfRegex(input: string): boolean {
    try {
        new RegExp(input);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Function to print CSV data after skipping the comments.
 * @param {string} filePath - The path to the CSV file.
 * @param {number} rowsToSkip - The number of rows to skip.
 */
export async function printCSV(filePath: string, rowsToSkip: number) {
    return new Promise<void>((resolve, reject) => {
        let lineCount = 0;
        let headers: any[];

        // Read the CSV file
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: { [x: string]: any; }) => {
                lineCount++;

                // Skip rows until the desired number of rows to skip is reached
                if (lineCount <= rowsToSkip || lineCount - rowsToSkip > 10) {
                    return;
                }

                // Print headers if not already printed
                if (!headers) {
                    headers = Object.keys(row);
                    console.log(headers.join('\t'));
                }

                // Print each row with tab-separated values
                console.log(headers.map((header) => row[header]).join('\t'));
            })
            .on('end', () => {
                resolve();
            })
            .on('error', (error: any) => {
                reject(error);
            });
    });
}

/**
 * Checks if the database file exists.
 * @param {string} databasePath - The path to the database file.
 * @returns {boolean} True if the file exists, false otherwise.
 */
export async function checkIfDatabaseExists(databasePath: string): Promise<boolean> {
    try {
        // Check if the file exists
        fs.accessSync(databasePath, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}


/**
 * Checks if a table exists in the database.
 * @param {string} databasePath - The path to the SQLite database file.
 * @param {string} tableName - The name of the table to check.
 * @returns {Promise<boolean>} - A Promise that resolves to true if the table exists, false otherwise.
 */
export async function checkIfTableExists(databasePath: string, tableName: string): Promise<boolean> {
    const sqlite3 = require('sqlite3');
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath);

        // Query to check if the table exists
        const query = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`;

        db.get(query, (err: any, row: any) => {
            if (err) {
                reject(err);
            } else {
                // Resolve with true if the table exists, false otherwise
                resolve(!!row);
            }
            // Close the database connection
            db.close();
        });
    });
}


/**
 * Check if a URL points to a valid CSV file.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} A Promise that resolves to false if the file is not valid CSV, or true if it is valid.
 */
export async function validateCSV(url: string): Promise<boolean> {
    try {
        // Fetch the content of the file
        const response = await axios.head(url); // Use HEAD request to fetch only headers
        // Check if the response is successful (status code 2xx)
        if (response.status >= 200 && response.status < 300) {
            // Check if the content type is CSV
            const contentType = response.headers['content-type'];
            if (contentType && (contentType.includes('text/csv') ||
                contentType.includes('text/plain') ||
                contentType.includes('application/csv') ||
                contentType.includes('application/vnd.ms-excel') ||
                contentType.includes('text/x-comma-separated-values') ||
                contentType.includes('application/octet-stream') ||
                contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                contentType.includes('text/csv-schema'))) {
                return true;
            } else {
                // If no matching MIME type found, check the file extension
                const fileExtension = url.split('.').pop()?.toLowerCase();
                if (fileExtension === 'csv' || fileExtension === 'txt') {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            // If the response is not successful, return false
            return false;
        }
    } catch (error) {
        // Handle any network or fetch errors
        return false;
    }
}

/** Reads the first line (skips empty lines and comments and header) to create a raw data preview.
 * @param {string} filePath - The path to the CSV file.
 * @param {number} rowsToSkip - The number of comment rows and/or empty rows.
 */
export function getPreviewData(filePath: string, rowsToSkip: number) {
    let previewData: string;
    return new Promise<string>((resolve, reject) => {
        let lineCount = 0;
        let skipHeder = true;
        // Create a read stream and a readline interface
        let stream = fs.createReadStream(filePath);
        let rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });
        // Read the file line by line
        let isClosed = false;
        rl.on('line', (line) => {
            // If the readline interface has been closed, return early
            if (isClosed) {
                return;
            }
            lineCount++;
            // Skip rows until the desired number of rows to skip is reached
            if (lineCount <= rowsToSkip) {
                return;
            }
            if (skipHeder) {
                skipHeder = false;
                return;
            }
            // Add the line to the preview data and close the readline interface
            previewData = line;
            rl.close();
            isClosed = true;
        });
        rl.on('error', reject);
        rl.on('close', () => resolve(previewData));

    });
}

interface WorkspaceFolders {
    workspace: string;
    folders: string[];
}
/** Searches all the folders in the workspace.
 * @returns {WorkspaceFolders|null} - An array of folder names in the workspace, or -1 if an error occurred.
 */
export function getFoldersInWorkspace(): WorkspaceFolders | null {
    const userDataPath = app.getPath('userData');
    try {
        const userDataPath = app.getPath("userData");
        const workspace = path.join(userDataPath, "workspace");
        const folders = fs.readdirSync(workspace, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        return {
            workspace,
            folders: folders.length > 0 ? folders : [],
        };

    } catch (error) {
        return null;
    }
}
