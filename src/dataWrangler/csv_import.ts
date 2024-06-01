/** The code in this file controls the Jayvee Data Wrangler by sending messages to the UI and creating and execution the Jayvee script. */
import * as fs from "fs";
import * as path from "path";
import * as helpers from "./helpers.js";
import * as fileHelpers from "./generate_and_update_files_and_folders.js";
import axios from "axios";
import * as readline from "readline";
import * as chardet from 'chardet';
import { fork } from 'child_process';
import { ipcMain } from 'electron';
import { mainWindow } from '../../index.js';

// Used to store all data needed for the pipeline
let pipeline: { [key: string]: any } = {
    directory: "",
    fileName: "",
    url: "",
    commentLines: 0,
    encoding: "",
    delimiter: "",
    enclosing: "",
    rowsToDelete: "",
    colsToDelete: "",
    header: [] as string[],
    valueTypes: [] as string[],
    databaseType: "",
    database: "",
    table: "",
    databasePath: "",
    createdValueTypes: [] as Array<[any[]]>,
    createdConstraints: [] as Array<[any[]]>,
};

// Used to identify the columns in the JayveeScript
let headerMapping: Record<number, string>;

/**
 * Function to await data which is needed to continue the workflow.
 * @returns {Promise<string>} A promise that resolves with the element where the data belongs to and the received data.
 */
async function waitForData() {
    return new Promise((resolve) => {
        // Define the IPC event handler
        const handler = (event: any, [input, data]: [string, any]) => {
            // Process data or perform actions here
            // Remove the listener to prevent memory leaks
            ipcMain.off('sendDataToCSVImports', handler);
            // Resolve the promise with the received data
            pipeline[input] = data;
            resolve([input, data]);
        };
        ipcMain.on('sendDataToCSVImports', handler);
    });
}

/**
 * Function to recognize changes in the header of datatable in the ui.
 * @param {string} input - The inputelement to change.
 * @param {any} data - The data to change.
 */
ipcMain.on('sendChangesToCSVImports', (event: any, [input, data]: [string, any]) => {
    if (input.includes("Header")) {
        input = input.split("Header")[1];
        pipeline.header[input] = data;
    } else if (input.includes("Value type")) {
        input = input.split("Value type")[1];
        pipeline.valueTypes[input] = data;
    } else {
        pipeline[input] = data;
    }
    pipeline[input] = data;
    return [input, data];
});

/** deletes a col from the table
* @param {number} columnIndex - Th e index of the column to remove.
* @param {string} columnName - The name of the column to remove.
*/
ipcMain.handle('removeColumn', async (event: any, [columnIndex, columnName]: [number, string]) => {
    let columIdentifyer = headerMapping[columnIndex];
    // Add the column to the list of columns to delete
    pipeline.colsToDelete += `column ${columIdentifyer},`;
    let index = pipeline.header.indexOf(columnName);
    // Remove the column from pipeline.header
    pipeline.header.splice(index, 1);
    // Remove the corresponding value type from pipeline.valueTypes
    pipeline.valueTypes.splice(index, 1);
    return 'removeColumnResponse';
});

/** delets a row from the table
* @param {number} rowIndex - The index of the row to remove.
* @param {any[]} rowData - The data of the row to remove.
*/
ipcMain.handle('removeRow', async (event: any, [rowIndex, rowData]: [number, any[]]) => {
    pipeline.rowsToDelete += `row ${rowIndex},`;
    return 'removeRowResponse';
});

/** Changes the header name 
* @param {number} columnIndex - The index of the column to change.
* @param {string} oldValue - The old header of the column.
* @param {string} newHeader - The new header of the column.
* @returns {string} A string indicating the success of the operation.
*/
ipcMain.handle('changeHeaderName', async (event: any, [columnIndex, oldValue, newHeader]: [number, string, string]) => {
    let index = pipeline.header.indexOf(oldValue);
    if (index !== -1) {
        pipeline.header[index] = newHeader;
        return 'changeHeaderResponse';
    }
    return 'changeHeaderError';
});

/** Changes the value type 
* @param {number} columnIndex - The index of the column to change.
* @param {string} oldValue - The old value type of the column.
* @param {string} newValue - The new value type of the column.
* @returns {string} A string indicating the success of the operation.
*/
ipcMain.handle('saveValueType', async (event: any, [columnIndex, oldValue, newValue]: [number, string, string]) => {
    pipeline.valueTypes[columnIndex] = newValue;
    return 'saveValueType';
});

/** Returns the value types of the columns */
ipcMain.handle('getValuetypes', async (event) => {
    return pipeline.valueTypes;
});

/** Restores the metadae from a database 
 * @param {string} databasePath - The path to the database.
 * @param {string} databaseName - The name of the database.
 * @param {string} tableName - The name of the table.
 * @param {string[]} header - The header of the table.
*/
ipcMain.handle('restoreMetadata', async (event, [databasePath, databaseName, tableName, header]) => {
    // Restore the metadata from the metadata databasse or the parameters given
    pipeline.header = header;
    headerMapping = helpers.createHeaderLetterMapping(pipeline.header);
    if (pipeline.valueTypes.length == 0) {
        pipeline.directory = databasePath.substring(0, databasePath.lastIndexOf('/'));
        pipeline.databasePath = pipeline.directory;
        pipeline.database = databaseName;
        pipeline.projectName = databaseName;
        pipeline.table = tableName;
        const metadata = await fileHelpers.loadMetadata(pipeline.database, pipeline.database, pipeline.table);
        if (metadata) {
            const keys = metadata.map((obj) => obj.key);
            const properties = [
                'fileName',
                'url',
                'commentLines',
                'encoding',
                'enclosing',
                'delimiter',
                'valueTypes',
                'databaseType',
                'createdValueTypes',
                'createdConstraints',
            ];
            properties.forEach(property => {
                if (property === 'valueTypes') {
                    pipeline[property] = metadata
                        .filter((obj) => obj.value.startsWith('ValueType:'))
                        .map((obj) => obj.value.replace('ValueType:', ''));
                } else if (property === 'createdConstraints' || property === 'createdValueTypes') {
                    pipeline[property] = metadata
                        .filter((obj) => obj.key === property)
                        .map((obj) => {
                            let parsedValue = JSON.parse(obj.value);
                            return parsedValue;
                        })
                        .flat();
                } else {
                    pipeline[property] = metadata
                        .filter((obj) => obj.value.startsWith(`${property}:`))
                        .map((obj) => obj.value.replace(`${property}:`, ''))[0];
                }
            });
        }
        // Send the constraints and valuetypes to the frontend
        return [pipeline.createdConstraints, pipeline.createdValueTypes];
    }
});

/** Checks if a regex is valid 
 * @param {string} regex - The regex to check.
 * @returns {boolean} A boolean value indicating whether the regex is valid.
 **/
ipcMain.handle('checkRegex', async (event: any, regex: string) => {
    return helpers.checkIfRegex(regex);
});

/** Creates a new valuetype 
 * @param {string[]} data - The data to create a new valuetype.
*/
ipcMain.on('createValuetype', async (event: any, data: any[]) => {
    pipeline.createdValueTypes.push(data);
});

/** Creates a new constraint 
 * @param {string[]} data - The data to create a new constraint.
*/
ipcMain.on('createConstraint', async (event: any, data: any[]) => {
    pipeline.createdConstraints.push(data);
});

/**
 * Function to create the piepline and start it when the user clicks on the start button. 
 * When its finised it sends a message to the frontend to display the result.
 */
ipcMain.on('pipelineStart', async () => {
    // Create the Jayvee file
    await fileHelpers.writeToFile(pipeline.directory, "pipeline.jv", `pipeline TestPipeline {Extractor -> TextFileInterpreter->RangeSelector->CSVInterpreter->ColumnDeleter->RowDeleter->TableInterpreter->Loader;block Extractor oftype HttpExtractor {
        url: "${pipeline.url}";}`);
    // Create the pipeline  
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
        `block TextFileInterpreter oftype TextFileInterpreter {encoding: "${pipeline.encoding}";}`);
    // Remove comments at the beginning of a file
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
        `block RangeSelector oftype TextRangeSelector {lineFrom: ${pipeline.commentLines + 1};}`);
    // Enclosing and delimiter
    if (pipeline.enclosing == '"') {
        await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
            `block CSVInterpreter oftype CSVInterpreter {enclosing: '${pipeline.enclosing}';delimiter: "${pipeline.delimiter}";}`);
    } else {
        await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
            `block CSVInterpreter oftype CSVInterpreter {enclosing: "${pipeline.enclosing}";delimiter: "${pipeline.delimiter}";}`);
    }
    // Remove cols
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
        `block ColumnDeleter oftype ColumnDeleter {delete: [${pipeline.colsToDelete}];}`);
    // Remove rows
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `block RowDeleter oftype RowDeleter {delete: [${pipeline.rowsToDelete}];}`);

    // Define the database connection
    pipeline.database = pipeline.projectName;
    pipeline.table = pipeline.projectName;

    // Create the table interpreter
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
        `block TableInterpreter oftype TableInterpreter {
            header: false;
            columns: [`);
    for (let i = 0; i < pipeline.header.length; i++) {
        if (i == pipeline.header.length - 1) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
                `"${pipeline.header[i]}" oftype ${pipeline.valueTypes[i]}];}`);
        } else {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
                `"${pipeline.header[i]}" oftype ${pipeline.valueTypes[i]},`);
        }

        // Store metadata in the database for e.g. loading the project later
        await fileHelpers.storeMetadata(pipeline.database, pipeline.database, pipeline.table, String(i), ["ValueType", pipeline.valueTypes[i]].join(':'));
    }
    const properties = [
        'fileName',
        'url',
        'commentLines',
        'encoding',
        'enclosing',
        'delimiter',
        'createdConstraints',
        'createdValueTypes',
        'databaseType',
    ];
    properties.forEach(async property => {
        let value = Array.isArray(pipeline[property]) ? JSON.stringify(pipeline[property]) : [property, pipeline[property]].join(':');
        await fileHelpers.storeMetadata(pipeline.database, pipeline.database, pipeline.table, property, value);
    });


    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv",
        `block Loader oftype SQLiteLoader {table: "${pipeline.table}"; 
    file: "${pipeline.database}.sqlite";}`);

    // Close the pipeline
    await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `}`);
    // Create value types
    for (let valueType of pipeline.createdValueTypes) {
        await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `valuetype ${valueType[0]} oftype ${valueType[1]} {constraints: [${valueType[2].join(', ')}];}`);
        // Store metadata in the database for e.g. loading the project later

    }
    // Create constraints
    for (let constraint of pipeline.createdConstraints) {
        // Check which type of constraint it is
        if (constraint[2].startsWith("Allow")) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `constraint ${constraint[0]} oftype AllowlistConstraint {allowlist: [${constraint[3].split(',').map((value: string) => `"${value.trim()}"`).join(', ')}];}`);
        } else if (constraint[2].startsWith("Deny")) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `constraint ${constraint[0]} oftype DenylistConstraint {denylist: [${constraint[3].split(',').map((value: string) => `"${value.trim()}"`).join(', ')}];}`);
        } else if (constraint[2].startsWith("Regex")) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `constraint ${constraint[0]} oftype RegexConstraint {regex: /${constraint[3].split(',').map((value: string) => `${value.trim()}`).join(', ')}/;}`);
        } else if (constraint[2].startsWith("Length")) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `constraint ${constraint[0]} oftype LengthConstraint {minLength: ${Number(constraint[3])};maxLength: ${Number(constraint[4])};}`);
        } else if (constraint[2].startsWith("Range")) {
            await fileHelpers.appendToFile(pipeline.directory, "pipeline.jv", `constraint ${constraint[0]} oftype RangeConstraint  {lowerBound: ${Number(constraint[3])};upperBound: ${Number(constraint[4])};}`);
        }
    }
    // Execute the pipeline
    const filePath = path.join(pipeline.directory, "pipeline.jv");
    const modulePath = path.join(__dirname, '../../node_modules/@jvalue/jayvee-interpreter/main.js');
    const child = fork(modulePath, [filePath], { cwd: pipeline.directory });
    child.on('error', (error) => {
        mainWindow?.webContents.send('pipelineFinished', true, [null, null, null]);
    });
    child.on('exit', (code) => {
        mainWindow?.webContents.send('pipelineFinished', false, [pipeline.directory, pipeline.database, pipeline.table]);
    });
});

/**
 * Determine the value types for each column in a CSV file.
 * @param {string} filePath - The path to the CSV file.
 * @param {number} numCols - The number of columns that are in the CSV.
 * @param {string} delimiter - The delimiter used in the CSV file.
 * @param {string} enclosing - The enclosing used in the CSV file.
 * @param {number} skipLines - Number of lines to skip including the header
 * @returns {Promise<string[]>} A Promise that resolves with an array of value types for each column.
 */
async function determineColumnValueTypes(filePath: string, numCols: number, delimiter: string, enclosing: string, skipLines: number): Promise<Array<string>> {
    return new Promise<Array<string>>(async (resolve, reject) => {
        const readStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

        // Initialize an array to store the value types for each column
        const columnValueTypes: Array<string> = new Array(numCols).fill("");

        // Regular expressions for integer and decimal
        const numberRegex = /^[+-]?([0-9]*[,.])?[0-9]+([eE][+-]?\d+)?$/;
        let lineCounter = 0;
        rl.on('line', (line) => {
            // Ignore comments and header
            if (lineCounter == skipLines + 1) {
                // Get the values without enclosing
                const values = [];
                let current = "";
                let withinEnclosing = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    if (char === enclosing) {
                        withinEnclosing = !withinEnclosing;
                    } else if (char === delimiter && !withinEnclosing) {
                        values.push(current);
                        current = "";
                    } else {
                        current += char;
                    }
                }

                values.push(current);
                // Counter to detect if all collumns are assigned with text -> stop scanning new lines, cause nothing would change
                let cnt = 0;
                // Compare the detected value types to the existing ones and update if needed
                values.forEach((value, index) => {
                    // Attempt to determine the value type
                    // Remove leading and trailing whitespaces and replace multiple whitespaces with a single whitespace to avoid false positives (e.g. " 1" would be detected as text instead of integer)
                    value = value.trim().replace(/\s{2,}/g, ' ');
                    // Skip if text was already assigned
                    if (columnValueTypes[index] != 'text') {
                        // Check if the integer column contains empy values -> datatype text
                        if (value == '') {
                            columnValueTypes[index] = "text";
                            cnt++;
                            mainWindow?.webContents.send('createDataElement', `emptyCells`,
                                `Warning: Detected empty cells, which are currently only supported by the text value type, so 'text' was assigned to the ${index}. column.`,
                                null);
                            // Check if all columns are text columns
                            if (cnt == numCols - 1) {
                                rl.removeAllListeners('line');
                                return;
                            }
                        } else if (value.toLowerCase() == "true" || value.toLowerCase() == "false") {
                            if (columnValueTypes[index] == "integer" || columnValueTypes[index] == "decimal") {
                                columnValueTypes[index] = "text";
                                cnt++;
                                // Check if all columns are text columns
                                if (cnt == numCols - 1) {
                                    rl.removeAllListeners('line');
                                    return;
                                }
                            } else {
                                columnValueTypes[index] = "boolean";
                            }
                        } else if (numberRegex.test(value)) { //intger   
                            const decimal = Number.parseFloat(value.replace(',', '.'));
                            const integer = Math.trunc(decimal);

                            if (decimal == integer) {
                                if (columnValueTypes[index] == "boolean") {
                                    columnValueTypes[index] = "text";
                                    cnt++;
                                    // Check if all columns are text columns
                                    if (cnt == numCols - 1) {
                                        rl.removeAllListeners('line');
                                        return;
                                    }
                                } else if (columnValueTypes[index] != "decimal") {
                                    columnValueTypes[index] = "integer";
                                }
                            } else { //decimal
                                if (columnValueTypes[index] == "boolean") {
                                    columnValueTypes[index] = "text";
                                    cnt++;
                                    // Check if all columns are text columns
                                    if (cnt == numCols - 1) {
                                        rl.removeAllListeners('line');
                                        return;
                                    }
                                } else {
                                    columnValueTypes[index] = "decimal";
                                }
                            }
                        } else {
                            columnValueTypes[index] = "text";
                            cnt++;
                            // Check if all columns are text columns
                            if (cnt == numCols - 1) {
                                rl.removeAllListeners('line');
                                return;
                            }
                        }
                    } else {
                        cnt++;
                        // Check if all columns are text columns
                        if (cnt == numCols - 1) {
                            rl.removeAllListeners('line');
                            return;
                        }
                    }
                });
            } else {
                lineCounter++;
            }
        });

        rl.on('close', () => {
            resolve(columnValueTypes);
        });

        rl.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Detects and returns the first x lines with comments in a CSV file, and moves them in a text file. Also detects empty lines between comments.
 * @param {string} inputFilePath - The path to the input CSV file.
 * @param {string} encoding - The encoding of the CSV file.
 * @returns {Promise<number>} A Promise that resolves with the number of lines containing comments.
 **/
async function detectComments(inputFilePath: string, encoding: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const commentIndicators = ["#", "//", ";", "--", "/*", "!", "%", "["];

        const readStream = fs.createReadStream(inputFilePath, { encoding: encoding as BufferEncoding });
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

        // File containing only the comments 
        // Extract directory path from input file path
        const outputDirectory = path.dirname(inputFilePath);

        // File containing only the comments
        const outputFileName = path.basename(inputFilePath, path.extname(inputFilePath)) + '_comments.txt';
        const outputFilePath = path.join(outputDirectory, outputFileName);
        const outputFileStream = fs.createWriteStream(outputFilePath, { encoding: encoding as BufferEncoding });
        let commentRows = 0;
        rl.on('line', (line) => {
            // Check if the line starts with any of the comment indicators -> write it to a separate file
            if (commentIndicators.some((indicator) => line.trim().startsWith(indicator)) || line.trim() == '') {
                outputFileStream.write(line + '\n');
                commentRows++;
            } else {
                rl.close();
            }
        });

        rl.on('close', () => {
            outputFileStream.end();
            if (commentRows == 0) {
                fs.unlinkSync(outputFilePath); // Delete the empty comment file
            }
            resolve(commentRows);
        });

        rl.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Checks if a CSV file has a header and returns it.
 * @param {string} filePath - The path to the CSV file.
 * @param {string} encoding - The encoding of the CSV file.
 * @param {string} delimiter - The delimiter used in the CSV file.
 * @param {numer} skipLines - Number of lines to skip (empty lines or comments).
 * @returns {Promise<string[]>} A Promise that resolves with an array containing the header if it exists; otherwise, it resolves with an empty array.
 */
async function getHeader(filePath: string, encoding: string, delimiter: string, skipLines: number): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        const readStream = fs.createReadStream(filePath, { encoding: encoding as BufferEncoding });
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
        let lineNumber = 0;
        let potHeader: string | null = null;
        rl.on('line', (line) => {
            if (lineNumber == skipLines - 1) {
                potHeader = line;
                rl.close();
            }
            lineNumber++;
        });
        rl.on('close', async () => {
            if (potHeader !== null) {
                // Split the first line using the provided delimiter
                const columns = potHeader.split(delimiter);
                // Check if all column contain non-numeric characters and resolve if all columns contain non-numeric characters          
                if (columns.every(column => isNaN(Number(column.trim())))) {
                    resolve(columns);
                } else {
                    resolve(new Array(columns.length).fill(null));
                }
            } else {
                resolve([]);
            }
            // Close the stream after processing the first line
            rl.close();
        });

        rl.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Detects the encoding of a file using the chardet library.
 * @param {string} filePath - The path to the file.
 * @param {string[]} supportedEncodings - An array of supported encodings.
 * @returns {Promise<string>} A Promise that resolves with the detected encoding.
 */
export async function detectCSVEncoding(filePath: string, supportedEncodings: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, async (err, data) => {
            if (err) {
                console.log(filePath)
                reject(err);
                return;
            }
            // Detect the encoding using chardet
            let encoding_detect = chardet.detect(data);
            // Format the encoidng for Jayvee
            let encoding = helpers.mapAndCheckEncoding(encoding_detect as string);
            while (encoding == null) {
                encoding = "";
                mainWindow?.webContents.send('createQuestionElement',
                    `Encoding detected as ${encoding_detect} which is not supported yet. Please choose one of the Supported encodings.`, true);
                mainWindow?.webContents.send('createDropdownElement', 'encoding', supportedEncodings);
                await waitForData().then((data) => {
                    if (data instanceof Array)
                        encoding = data[1] as string;
                });
                // Remove the dropdown element
                mainWindow?.webContents.send('removeElement', 'encoding');
                encoding = helpers.mapAndCheckEncoding(encoding);
            }
            resolve(encoding);
        });
    });
}

/**
 * Reads the first line of a CSV file to determine the delimiter.
 * @param {string} filePath - The path to the CSV file.
 * @param {string} encoding - The encoding of the CSV file
 * @param {number} skipLines - Number of lines to skip
 * @returns {Promise<string>} A Promise that resolves with the identified delimiter.
 */
async function identifyCSVDelimiter(filePath: string, encoding: string, skipLines: number): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        // Open the file and read it line by line
        const readStream = fs.createReadStream(filePath, { encoding: encoding as BufferEncoding });
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
        let sampleLine: string | null = null;
        let lineNumber = 0;
        rl.on('line', (line) => {
            if (lineNumber == skipLines - 1) {
                sampleLine = line;
                rl.close();
            }
            lineNumber++;
        });

        rl.on('close', async () => {
            const potentialDelimiter = [',', ';', '\t', '|', ':', ' '];
            let bestDelimiter: string | null = null;
            let maxDelimiterCount = 0;

            // Count the occurrences of each delimiter in the sample lines
            for (const delimiter of potentialDelimiter) {
                if (sampleLine) {
                    const delimiterCount = sampleLine.split(delimiter).length - 1;
                    // Update the best delimiter if the count is higher
                    if (delimiterCount > maxDelimiterCount) {
                        maxDelimiterCount = delimiterCount;
                        bestDelimiter = delimiter;
                    }
                }
            }
            // Resolve with the best delimiter if found, otherwise prompt the user
            if (bestDelimiter) {
                resolve(bestDelimiter);
            } else {
                // Prompt the user for the delimiter
                mainWindow?.webContents.send('createQuestionElement',
                    `Unable to determine the delimiter. Please enter the delimiter.`, true);
                mainWindow?.webContents.send('createInputElement', `delimiter`, `Delimiter`, null, 1);
                let userInput = "";
                await waitForData().then((data) => {
                    if (data instanceof Array)
                        userInput = data[1] as string;
                });
                // Continue with the provided delimiter
                const delimiter = userInput;
                mainWindow?.webContents.send('removeElement', 'delimiter');
                resolve(delimiter);
            }
        });

        rl.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Reads the first content line of a CSV file to determine the enclosing.
 * @param {string} filePath - The path to the CSV file.
 * @param {string} encoding - The file encoding.
 * @param {string} delimiter - The column delimiter.
 * @param {numer} skipLines - Number of lines to skip (empty lines or comments).
 * @returns {Promise<string>} A Promise that resolves with the identified enclosing.
 */
async function identifyCSVEnclosing(filePath: string, encoding: string, delimiter: string, skipLines: number): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        // Open the file and read it line by line
        const readStream = fs.createReadStream(filePath, { encoding: encoding as BufferEncoding });
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

        const potentialEnclosingChars = ['"', "'"];
        let potentialEnclosing: string = "";
        let lineNumber = 0;
        rl.on('line', (line) => {
            if (lineNumber == skipLines) { // skips the header
                let charBefore = "";
                for (const char of line) {
                    if (potentialEnclosingChars.includes(charBefore) && char == delimiter) { //delimiter follows on enclosing
                        potentialEnclosing = charBefore;
                    }
                    charBefore = char;
                }
            }
            lineNumber++;
        });

        rl.on('close', async () => {
            if (potentialEnclosing == "" || potentialEnclosingChars.includes(potentialEnclosing)) {
                resolve(potentialEnclosing);
                return;
            }
            // If none of the potential enclosing characters are found, prompt the user
            let userInput: string = "";
            do {
                mainWindow?.webContents.send('createQuestionElement',
                    `Unable to determine the enclosing character. Please enter the enclosing character.`, true);
                mainWindow?.webContents.send('createInputElement',
                    `enclosing`, `enclosing`, null, 1);
                await waitForData().then((data) => {
                    if (data instanceof Array)
                        userInput = data[1] as string;
                });
            } while (userInput.length !== 1 || potentialEnclosingChars.includes(userInput));
            mainWindow?.webContents.send('removeElement', 'delimenclosingiter');
            resolve(userInput);
        });

        rl.on('error', (error) => {
            reject(error);
        });
    });
}

/**
* Downloads a CSV file by prompting the user for the file's URL.
* @returns {Promise<string>} The name of the CSV file.
*/
export async function downloadCSV(): Promise<string> {
    // Check if we got a valid url
    const check = await helpers.validateCSV(pipeline.url);
    let fileName: string;
    if (!check) {
        throw new Error("The URL you provided is not valid or the file is damaged. Please provide a different URL.");
    }
    let writeStream: fs.WriteStream;
    let filePath: string;

    // Check if the url is available and the file is downloadable
    // For future improvements: enable that timeout can be changed in UI within the settings
    try {
        const response = await axios({
            url: pipeline.url,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000, // one minute
        });

        // Check if the response status is not in the 200 range
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`The URL you provided isn't available at the moment. Please try again later.`);
        }

        // Create a unique filename for the downloaded CSV file
        fileName = `${pipeline.url.split('/').pop()}`;
        fileName = `${fileName.substring(0, fileName.lastIndexOf('.'))}_${Date.now()}${fileName.substring(fileName.lastIndexOf('.'))}`;
        filePath = path.join(pipeline.directory, fileName);

        // Wirte the csv to the file system
        writeStream = fs.createWriteStream(filePath);
        response.data.pipe(writeStream);
    } catch (error) {
        throw new Error(`The URL you provided isn't available at the moment. Please try again later.`);
    }




    // Return the name of the downloaded CSV file
    return new Promise<string>((resolve, reject) => {
        writeStream.on('finish', () => {
            resolve(fileName);
        });

        writeStream.on('error', (error: any) => {
            reject(error);
        });
    });

}

/**
 * Interprets a CSV file (semi) automaticly and creates the Jayvee pipeline.
 * @param {string} filePath - The path of the file to be interpreted. Must be an absolute or relative path to the file.
 * @param {string} fileName - The name of the csv file. 
 */
export async function interpretCSV(): Promise<void> {
    let projectName = pipeline.fileName.replace(/\d+\.csv$/, ''); //Remove .csv and timestamp
    let filePath = path.join(pipeline.directory, pipeline.fileName);
    // Create a preview of the data to show in the UI in case the user wants to change encoding, delimiter, or enclosing
    mainWindow?.webContents.send('createDataElement', `filePreview`, `Preview of the first line of the CSV file without comments or empty lines (showing raw data):`, null);
    const previewData = await helpers.getPreviewData(filePath, pipeline.commentLines);
    mainWindow?.webContents.send('createDataElement', `filePreviewData`, previewData, null);

    // Get the encoding
    const supportedEncodings = ['utf8', 'ibm866', 'latin2', 'latin3', 'latin4', 'cyrillic', 'arabic', 'greek', 'hebrew', 'logical', 'latin6', 'utf-16'];
    pipeline.encoding = await detectCSVEncoding(filePath, supportedEncodings);
    // Find out how many lines are to skip, assuming we have a header
    pipeline.commentLines = await detectComments(filePath, pipeline.encoding);

    mainWindow?.webContents.send('createParagraphWithEditableText', `encoding`, `Encoding: `, pipeline.encoding, 1, null, supportedEncodings);
    // Find out delimiter and enclosing to create a CSVInterpreter
    pipeline.delimiter = await identifyCSVDelimiter(filePath, pipeline.encoding, pipeline.commentLines + 1);
    // Allow all delimiters or only the common ones
    // let allowedDelimiters= [',', ';', '\t', '|', ':', ' '];
    let allowedDelimiters = null;
    mainWindow?.webContents.send('createParagraphWithEditableText', `delimiter`, `Delimiter: `, pipeline.delimiter, 1, allowedDelimiters, null);
    pipeline.enclosing = await identifyCSVEnclosing(filePath, pipeline.encoding, pipeline.delimiter, pipeline.commentLines + 1);
    // Allow all enclosings or only  the common ones
    // let allowedEnclosings = ['"', "'"];
    let allowedEnclosings = null;
    mainWindow?.webContents.send('createParagraphWithEditableText', `enclosing`, `Enclosing: `, pipeline.enclosing, 1, allowedEnclosings, null);
    // ? Enclosing Escape
    let escape = "'";
    if (pipeline.enclosing == "'") {
        escape = "";
    }
    // await helpers.printCSV(filePath, commentLines);
    // Check if the csv has a header
    pipeline.header = await getHeader(filePath, pipeline.encoding, pipeline.delimiter, pipeline.commentLines + 1);
    const lenHeader = pipeline.header.length;
    if (pipeline.header[0] == null) {
        // Assign default header names col1, col2, col3, etc.
        pipeline.header = Array.from({ length: lenHeader }, (_, index) => `col${index + 1}`);
    }
    // Check the header for duplicates and rename them
    if (await helpers.renameDuplicates(pipeline.header)) {
        mainWindow?.webContents.send('createDataElement', `duplicateHeader`, `Identified duplicate header descriptions; automatically added literals to ensure uniqueness.`, null);
    }
    headerMapping = helpers.createHeaderLetterMapping(pipeline.header);
    pipeline.valueTypes = await determineColumnValueTypes(filePath, lenHeader, pipeline.delimiter, pipeline.enclosing, pipeline.commentLines);

    // If other database types are added, the following code needs to be adjusted
    pipeline.databaseType = "SQLite";
    // Create a button to run the pipeline
    mainWindow?.webContents.send('createPipelineRunButton', 'runPipeline', 'Start the import process');
}

/** Creates a new project, initializes the project folder, creates and runs the pipeline.jv file. 
* To get data from the ui, it communicates with the render process via ipcRenderer.
* @returns {Promise<boolean>} A Promise that resolves with a boolean value indicating whether the project was created successfully.
*/
export async function createNewProject(): Promise<void> {
    // Create working directory
    let projectName = "";
    mainWindow?.webContents.send('createQuestionElement', `Please enter a unique project name. You can use letters (A-Z, a-z), numbers (0-9), underscores _, and parentheses ().`,
        false);
    mainWindow?.webContents.send('createInputElement', `projectName`, `Project name`, /^[A-Za-z0-9]+$/, 255);// 255 is the max length of a folder name in windows

    while (pipeline.directory == "") {
        await waitForData().then((data) => {
            if (data instanceof Array)
                projectName = data[1] as string;
        });
        try {
            pipeline.directory = await fileHelpers.createDirectory(projectName);
            pipeline.databasePath = pipeline.directory;
        } catch (error) {
            {
                mainWindow?.webContents.send('createQuestionElement', `Project already exists. Please choose a different name. Remember you can use letters (A-Z, a-z), numbers (0-9), underscores _, and parentheses ().`, true);
                mainWindow?.webContents.send('createInputElement', `projectName`,
                    `Project name`, /^[A-Za-z0-9_()]+$/, 255);// 255 is the max length of a folder name in windows
            }
        }
    }
    {
        mainWindow?.webContents.send('createDataElement', `projectLocation`, `Project location: ${pipeline.directory}`, `textWithFolder`);
        mainWindow?.webContents.send('createQuestionElement', `Please provide the URL of the CSV file you want to import:`, false);
        mainWindow?.webContents.send('createInputElement', `url`, `CSV URL`, null, null);
    }
    await waitForData().then((data) => {
        if (data instanceof Array) {
            pipeline.url = (data[1] as string).trim(); // remove spaces
        }
    });
    // Download CSV
    while (pipeline.fileName == "") {
        try {
            pipeline.fileName = await downloadCSV();
        } catch (error) {
            if ((error as Error).message.includes("The URL you provided isn't available at the moment. Please try again later.")) {
                mainWindow?.webContents.send('createQuestionElement', `The URL you provided isn't available at the moment. Please try again later.`, true);
            } else if ((error as Error).message.includes("The URL you provided is not valid or the file is damaged. Please provide a different URL.")) {
                mainWindow?.webContents.send('createQuestionElement', `The URL you provided is not valid or the file is damaged. Please provide a different URL.`, true);
                mainWindow?.webContents.send('createInputElement', `url`, `Please provide a valid URL`, null, null);
            }
            await waitForData().then((data) => {
                if (data instanceof Array)
                    pipeline.url = (data[1] as string).trim(); // remove spaces
            });
        }
    }
    // Interpret the csv
    await interpretCSV();
}

// Resets all variables
export async function cleanup() {
    pipeline = {
        directory: "",
        fileName: "",
        url: "",
        commentLines: 0,
        encoding: "",
        delimiter: "",
        enclosing: "",
        rowsToDelete: "",
        colsToDelete: "",
        header: [] as string[],
        valueTypes: [] as string[],
        databaseType: "",
        database: "",
        table: "",
        databasePath: "",
        createdValueTypes: [] as Array<[any[]]>,
        createdConstraints: [] as Array<[any[]]>,
    };
}