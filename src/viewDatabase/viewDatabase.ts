/** Controls the UI wehn viewing data. Enabnles features for editing data.
 * Steps, if more buttos/features are added:
 * 1. Add the new button/feature to the datatable toolbar. Keep in mind, that the action can take long on large datasets, so the user should be informed about the progress. You can use the span in the toolbar for this.
 * 2. If the button/feature requires user interaction, add the necessary event listener. The event listener should add the change to the actionsDone array. If necessary, also save the old state in the array. Clear actionsToRedo array. 
 * 3. Update the toolbar buttons by executing the function updateToolbar() at the end of the event listener. 
 * 4. Update the undo and redo event listeners to handle the new action.
 * 5. Ad a ipcRenderer.on() event listener for the change in csv_import to make the change in the Jayvee-Script and database
 */
declare const $: any;
const htmlHelpers = window.electron.createHTMLElements;

// Get the database path and table name from the URL
let params = new URLSearchParams(window.location.search);
let dbPath = params.get('databasePath');
let tableName = params.get('tableName');

let rowCount = 0;
let drawAfterRows = 10;
let deletedColumns: number[] = [];
let deletedRows: number[] = [];
let actionsDone: [string, any[]][] = [];
let actionsToRedo: [string, any[]][] = [];
let valuetypes: string[] = []; // Valuetype of the columns
let allowedValuetypes: string[] = []; // Contains all base valutetypes and the created valutetypes
let createdValueTypes: [string, string, any[]][] = [];
let createdConstraints: string[] = [];
let baseValueTypes = ["text", "integer", "decimal"];
const crossedOutRows = new Map<number, string[]>();

async function connectToDatabase(databasePath: string) {
    window.electron.send('connectToDatabase', databasePath);
}

/** Execute a SQL query and return all results.
 * @param {string} sqlQuerry - The SQL query to execute. 
 * @returns {Promise<any>} - The result of the query. 
 */
async function dbAll(sqlQuerry: string): Promise<any> {
    try {
        const rows = await window.electron.invoke('dbAll', sqlQuerry);
        return rows;
    } catch (err) {
        console.error(err);
    }
}

/** Execute a SQL query and return the results row by row.
 * @param {string} sqlQuerry - The SQL query to execute.
 * @returns {Promise<any>}   - The result of the query. 
 */
async function dbEach(sqlQuerry: string): Promise<any> {
    try {
        const row = window.electron.send('dbEach', sqlQuerry);
        return row;
    } catch (err) {
        console.error(err);
    }
}

/* This function checks if a value != '' matches the type of the column 
@param {string} value - The value to check  
@param {string} type - The type of the column
*/
function matchesType(value: string, type: string): boolean {
    switch (type) {
        case 'integer':
            return Number.isInteger(Number(value));
        case 'decimal':
            return !isNaN(Number(value));
        case 'boolean':
            return value === 'true' || value === 'false';
        default:
            return true;
    }
}

$(document).ready(async function () {
    // Reset all variables to avoid conflicts
    params = new URLSearchParams(window.location.search);
    dbPath = params.get('databasePath');
    tableName = params.get('tableName');
    rowCount = 0;
    drawAfterRows = 10;
    deletedColumns = [];
    deletedRows = [];
    actionsDone = [];
    actionsToRedo = [];
    valuetypes = [];
    allowedValuetypes = [];
    createdValueTypes = [];
    createdConstraints = [];
    baseValueTypes = ["text", "integer", "decimal"];
    const crossedOutRows = new Map<number, string[]>();
    // Create a simple HTML table
    const table = document.createElement('table');
    table.id = 'database';

    // Append the table to the mainFrame div
    $('#databaseElement').append(table);


    // Query the SQLite database for the table info
    if (dbPath) {
        connectToDatabase(dbPath);
    }
    let columns: any = [];

    // Create all buttons
    const saveInputButton = htmlHelpers.createButton('saveInput', '', 'fa-save', null);
    const openFolderButton = htmlHelpers.createButton('openFolder', '', 'fa-folder-open', null);
    const undoButton = htmlHelpers.createButton('undo', '', 'fa-undo', null);
    const redoButton = htmlHelpers.createButton('redo', '', 'fa-redo', null);
    const createValuetypeButton = htmlHelpers.createButton('createValuetype', 'Create ValueType', null, null);
    const createConstraintButton = htmlHelpers.createButton('createConstraint', 'Create constraint', null, null);
    const viewConstraintsAndValuetypesButton = htmlHelpers.createButton('viewConstraintsAndValuetypes', 'View valuetypes and constraints', null, null);
    const toolbarText = $('<span>').text('');

    const deleteColButton = htmlHelpers.createButton('deleteCol', '', 'fa-trash', null);
    const deleteRowButton = htmlHelpers.createButton('deleteRow', '', 'fa-trash', null);
    const viewStatistics = htmlHelpers.createButton('viewStatistics', '', 'fa-chart-bar', null);

    await dbAll(`PRAGMA table_info("${tableName}")`).then(async (data) => {
        // Set the DataTable columns
        columns = data.map((d: { name: any; }) => ({ title: d.name }));
        // If the database was loaded from a previous session, the metadata inside csv_import has to be restored first
        const titles = columns.map((column: { title: any; }) => column.title);
        const answer = await window.electron.invoke('restoreMetadata', [dbPath, tableName, tableName, titles]);
        if (answer != undefined) {
            createdConstraints = answer[0];
            createdValueTypes = answer[1];
        }
        allowedValuetypes = ["text", "integer", "decimal", "boolean"];
        allowedValuetypes.push(...createdValueTypes.map((valuetype) => valuetype[0]));



    }).catch((err) => {
        console.error(err);
    });

    // Create a DataTable
    let dataTable = $('#database').DataTable({
        dom: 'f<"toolbar">rtip', // Add a "toolbar" class to the dom
        // Add the columns using the header loaded from the database and add a column for the delete buttons
        columns: ['', ...columns, { title: '', defaultContent: deleteRowButton.outerHTML }],
        width: '100%',
        scrollCollapse: true,
        fixedHeader: true,
        paging: true,
        searching: true,
        columnDefs: [{
            targets: '_all',
            orderable: false,
        }],
        order: [],
        // This function handles the display of entries if the user navigates to another page
        drawCallback: function () { // Check if the valuetypes have been changed in the ui
            const tableElement = table as any; // Cast table to any type
            columns.slice().forEach((col: any, index: number) => {
                const dropdown = document.getElementById(`dropdown-${index}`) as HTMLSelectElement;
                if (dropdown) {
                    checkValueType(dropdown, index);
                    modifyDisplay(dropdown, index);
                }
            });
            deletedColumns.forEach(function (colIndex) {
                $(tableElement).find('td').filter(function (this: any) {
                    return $(this).index() === colIndex;
                }).css({
                    'color': '#cccccc',
                    'text-decoration': 'line-through'
                });
            });
            // Apply styles to deleted rows
            this.api().rows().every(function (this: any) {
                const row = this.node();
                const data = this.data();
                if (deletedRows.includes(data[0])) {
                    $(row).find('td').css({
                        'color': '#cccccc',
                        'text-decoration': 'line-through'
                    });
                    // Disable the delete button
                    $(row).find('#deleteRow').addClass('disabled');
                }
            });
        },
    });
    // Add a row below the header with the valuetypes
    valuetypes = await window.electron.invoke('getValuetypes');

    // Create a new row for the valuetypes
    let valueTypeRow = document.createElement('tr');
    valueTypeRow.innerHTML = '<td>Valuetypes</td>';

    columns.forEach((col: any, index: number) => {
        const uniqueID = `dropdown-${index}`;
        const dropdown = htmlHelpers.createDropdown(uniqueID, allowedValuetypes, valuetypes[index], false, false, null, null);
        const td = document.createElement('td');
        td.appendChild(dropdown);
        valueTypeRow.appendChild(td);
    });
    // Append the row to the table header
    document.querySelector('#database thead')?.appendChild(valueTypeRow);
    columns.forEach((col: any, index: number) => {
        const dropdown = document.getElementById(`dropdown-${index}`) as HTMLSelectElement;
        if (dropdown) {
            // Handle dropdown value switch
            dropdown.addEventListener('change', () => {
                const uniqueID = `dropdown-${index}`;
                saveDropdown(uniqueID, 'saveValueType')
                // Activate the save button when the dropdown value changes
                saveInputButton.classList.remove('disabled');
                undoButton.classList.remove('disabled');
                // Update the rows if the value doesn't fit the type anymore
                checkValueType(dropdown, index);
                modifyDisplay(dropdown, index);
            });
        }
    });


    /**Modifys the display of the of the column if it was deleted or the value type was changed or undo or red was performed
     * @param {HTMLSelectElement} dropdown - The dropdown element which might has been switched
     * @param {number} index - The index of the column to check
     */
    function modifyDisplay(dropdown: HTMLSelectElement, index: number) {
        const allRows = document.querySelectorAll('#database tbody tr');
        // if column was deleted, user can't modify the value type
        // Reset the style of the rows that were crossed out by the deleted column
        if (deletedColumns.includes(index + 1)) {
            allRows.forEach((row) => {
                for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                    if (deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                    const rowid = (row as HTMLTableRowElement).cells[0].innerText;
                    let crossedOutBy = crossedOutRows.get(Number(rowid));
                    if (crossedOutBy && crossedOutBy.includes(dropdown.id)) {
                        (row as HTMLTableRowElement).cells[i].style.textDecoration = 'unset';
                        (row as HTMLTableRowElement).cells[i].style.color = '#000000';
                    }
                }
            });
        } else {
            allRows.forEach((row) => {
                // Get the cell
                const cell = (row as HTMLTableRowElement).cells[index + 1];//+1 because of the index column
                // Reset the row style only if it's not crossedOut by another column
                const rowid = (row as HTMLTableRowElement).cells[0].innerText;

                let crossedOutBy = crossedOutRows.get(Number(rowid));
                if (crossedOutBy && crossedOutBy.length < 1) {
                    // Dropdown is the only one crossing out this row -> reset style
                    for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                        if (deletedColumns.includes(i) || deletedRows.includes(Number(rowid))) continue; // Skip the current column, if it was deleted or if the row was deleted
                        (row as HTMLTableRowElement).cells[i].style.textDecoration = 'unset';
                        (row as HTMLTableRowElement).cells[i].style.color = '#000000';
                    }
                }
                // If the cell value does not match the selected type, cross it out
                if (baseValueTypes.includes(dropdown.value) || dropdown.value === 'boolean') {
                    // Remove empty entries if the valuetype is not text
                    if ((dropdown.value != 'text' && cell.innerText == '') || !matchesType(cell.innerText, dropdown.value)) { // Cell of collumn is empty
                        for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                            if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                            (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                            (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                        }
                    }
                } else { // Custom valuetype
                    // Check baseval of created valuetype
                    const valuetype = createdValueTypes.find((valuetype) => valuetype[0] === dropdown.value);
                    const baseval = valuetype?.[1];
                    if (baseval && !matchesType(cell.innerText, baseval)) {
                        for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                            if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                            (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                            (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                        }
                    } else {
                        // Check constraints of created valuetype
                        const constraints = valuetype?.[2];
                        if (constraints) {
                            for (const constraint of constraints) {
                                const constraintData = createdConstraints.find((c) => c[0] === constraint);
                                const constraintType = constraintData?.[2];
                                if (constraintType?.includes('Allowlist')) {
                                    const allowedValues = constraintData?.[3];
                                    if (allowedValues) {
                                        const allowedValuesArray = allowedValues.split(',');
                                        if (!allowedValuesArray.includes(cell.innerText)) {
                                            for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                                                if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                                                (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                                                (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                                            }
                                        }
                                    }
                                } else if (constraintType?.includes('Denylist')) {
                                    const deniedValues = constraintData?.[3];
                                    if (deniedValues) {
                                        const deniedValuesArray = deniedValues.split(',');
                                        if (deniedValuesArray?.includes(cell.innerText)) {
                                            for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                                                if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                                                (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                                                (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                                            }
                                        }
                                    }
                                } else if (constraintType?.includes('Length')) {
                                    const min = Number(constraintData?.[3]);
                                    const max = Number(constraintData?.[4]);
                                    if (cell.innerText.length < min || cell.innerText.length > max) {
                                        for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                                            if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                                            (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                                            (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                                        }
                                    }
                                } else if (constraintType?.includes('Range')) {
                                    const min = Number(constraintData?.[3]);
                                    const max = Number(constraintData?.[4]);
                                    if (Number(cell.innerText) < min || Number(cell.innerText) > max) {
                                        for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                                            if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                                            (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                                            (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                                        }
                                    }
                                } else if (constraintType?.includes('Regex')) {
                                    const regex = constraintData?.[3];
                                    if (regex && !new RegExp(regex).test(cell.innerText)) {
                                        for (let i = 1; i < (row as HTMLTableRowElement).cells.length; i++) {
                                            if (i == index + 1 && deletedColumns.includes(i)) continue; // Skip the current column, if it was deleted
                                            (row as HTMLTableRowElement).cells[i].style.textDecoration = 'line-through';
                                            (row as HTMLTableRowElement).cells[i].style.color = '#cccccc';
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                // reset style of delete buttons
                const lastCell = (row as HTMLTableRowElement).cells[(row as HTMLTableRowElement).cells.length - 1];
                lastCell.style.textDecoration = 'none';
                lastCell.style.color = 'initial';
                lastCell.style.backgroundColor = 'initial';
            });
        }
    }

    /**Checks if the value fits the type of the column and if not adds the row to the crossedOutRows map
     * @param {HTMLSelectElement} dropdown - The dropdown element which might has been switched
     * @param {number} index - The index of the column to check
     */
    function checkValueType(dropdown: HTMLSelectElement, index: number) {
        let dataTable = $('#database').DataTable();
        const allRows = dataTable.rows().data().toArray();
        // if column was deleted, user can't change the type
        if (deletedColumns.includes(index + 1)) return; // +1 because of the index column
        allRows.forEach((rowData: any[]) => {
            // Get the cell
            const cell = rowData[index + 1]; //+1 because of the index column
            const rowid = rowData[0];
            let crossedOutBy = crossedOutRows.get(rowid) ?? [];
            if (baseValueTypes.includes(dropdown.value) || dropdown.value === 'boolean') {
                if (dropdown.value != 'text' && cell == '') { // Cell of collumn is empty
                    if (!crossedOutBy.includes(dropdown.id))
                        crossedOutBy.push(dropdown.id);
                } else if (!matchesType(cell, dropdown.value)) {
                    if (!crossedOutBy.includes(dropdown.id))
                        crossedOutBy.push(dropdown.id);
                } else { // Cell value fits the type of the column
                    crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                    crossedOutRows.set(rowid, crossedOutBy);
                }
            } else { // Custom valuetype
                // Check baseval of created valuetype
                const valuetype = createdValueTypes.find((valuetype) => valuetype[0] === dropdown.value);
                const baseval = valuetype?.[1];
                if (baseval && !matchesType(cell, baseval)) {
                    if (!crossedOutBy.includes(dropdown.id))
                        crossedOutBy.push(dropdown.id);
                } else if (baseval != 'text' && cell == '') {
                    // Remove empty entries if the baseval is not text
                    if (!crossedOutBy.includes(dropdown.id))
                        crossedOutBy.push(dropdown.id);
                } else {
                    // Check constraints of created valuetype
                    const constraints = valuetype?.[2];
                    if (constraints) {
                        for (const constraint of constraints) {
                            const constraintData = createdConstraints.find((c) => c[0] === constraint);
                            const constraintType = constraintData?.[2];
                            if (constraintType?.includes('Allowlist')) {
                                const allowedValues = constraintData?.[3];
                                if (allowedValues) {
                                    const allowedValuesArray = allowedValues.split(',');
                                    if (!allowedValuesArray.includes(cell)) {
                                        if (!crossedOutBy.includes(dropdown.id))
                                            crossedOutBy.push(dropdown.id);
                                    } else { // Cell value fits the type of the column
                                        crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                                        crossedOutRows.set(rowid, crossedOutBy);
                                    }
                                }
                            } else if (constraintType?.includes('Denylist')) {
                                const deniedValues = constraintData?.[3];
                                if (deniedValues) {
                                    const deniedValuesArray = deniedValues.split(',');
                                    if (deniedValuesArray?.includes(cell)) {
                                        if (!crossedOutBy.includes(dropdown.id))
                                            crossedOutBy.push(dropdown.id);
                                    } else { // Cell value fits the type of the column
                                        crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                                        crossedOutRows.set(rowid, crossedOutBy);
                                    }
                                }
                            } else if (constraintType?.includes('Length')) {
                                const min = Number(constraintData?.[3]);
                                const max = Number(constraintData?.[4]);
                                if (cell.length < min || cell.length > max) {
                                    if (!crossedOutBy.includes(dropdown.id))
                                        crossedOutBy.push(dropdown.id);
                                } else { // Cell value fits the type of the column
                                    crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                                    crossedOutRows.set(rowid, crossedOutBy);
                                }
                            } else if (constraintType?.includes('Range')) {
                                const min = Number(constraintData?.[3]);
                                const max = Number(constraintData?.[4]);
                                if (Number(cell) < min || Number(cell) > max) {
                                    if (!crossedOutBy.includes(dropdown.id))
                                        crossedOutBy.push(dropdown.id);
                                } else { // Cell value fits the type of the column
                                    crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                                    crossedOutRows.set(rowid, crossedOutBy);
                                }
                            } else if (constraintType?.includes('Regex')) {
                                const regex = constraintData?.[3];
                                if (regex && !new RegExp(regex).test(cell)) {
                                    if (!crossedOutBy.includes(dropdown.id))
                                        crossedOutBy.push(dropdown.id);
                                    if (cell === '') {
                                        if (!crossedOutBy.includes(dropdown.id))
                                            crossedOutBy.push(dropdown.id);
                                    }
                                } else { // Cell value fits the type of the column
                                    crossedOutBy = crossedOutBy.filter((value) => value !== dropdown.id);
                                    crossedOutRows.set(rowid, crossedOutBy);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    // Add a row below the valuetypes with action buttons
    $('#database thead').append('<tr><td>Actions</td>' + columns.slice(1).map(() => `<td>${deleteColButton.outerHTML}${viewStatistics.outerHTML}</td>`).join('') + `<td>${deleteColButton.outerHTML}${viewStatistics.outerHTML}</td><td></td></tr>`);

    // Add the save changes button to the toolbar
    $("div.toolbar").html(saveInputButton);
    $("div.toolbar").append(openFolderButton);
    $("div.toolbar").append(undoButton);
    $("div.toolbar").append(redoButton);
    $("div.toolbar").append(createValuetypeButton);
    $("div.toolbar").append(createConstraintButton);
    $("div.toolbar").append(viewConstraintsAndValuetypesButton);
    $("div.toolbar").append(toolbarText);

    // Disable all buttons until the user makes a change
    undoButton.classList.add('disabled');
    redoButton.classList.add('disabled');
    saveInputButton.classList.add('disabled');

    $('#database').on('click', '#deleteCol', async function (this: any) {
        // Get the index of the column
        const columnIndex = $(this).closest('td').get(0).cellIndex;
        deletedColumns.push(columnIndex);
        // Get the column name
        const columnName = $(dataTable.column(columnIndex).header()).text()
        // "Disable" the column
        dataTable.columns(columnIndex).every(function (this: any) {
            $(this.nodes()).css({
                'color': '#cccccc',
                'text-decoration': 'line-through'
            });
        });
        $(this).addClass('disabled');
        actionsDone.push(["removeColumn", [columnIndex - 1, columnName]]); //-1 because of the index column
        // Disable all buttons inside the header
        document.querySelector(`#headerTextField_${columnIndex}`)?.querySelectorAll('button').forEach(button => button.classList.add('disabled'));
        actionsToRedo = [];
        updateToolbar();
        // Reset the style of the rows that were crossed out by the deleted column
        modifyDisplay(document.getElementById(`dropdown-${columnIndex - 1}`) as HTMLSelectElement, columnIndex - 1);
        // Deactivate the valuetype dropdown for this column
        const dropdown = document.getElementById(`dropdown-${columnIndex - 1}`) as HTMLSelectElement;
        dropdown.setAttribute('disabled', 'true');
        // Disable statistics button
        const statisticsBtn = document.querySelector(`td:nth-child(${columnIndex + 1}) #viewStatistics`) as HTMLButtonElement;
        statisticsBtn.classList.add('disabled');
    });

    $('#database').on('click', '#deleteRow', function (this: any) {
        // Get the row element
        const rowElement = $(this).parents('tr');
        // Get the row data
        const rowData = dataTable.row(rowElement).data();
        // Get the index column's value
        const rowId = rowData[0];
        // Modify the Jayvee Script
        actionsDone.push(["removeRow", [rowId + 1, rowData]]);// +1 because the header is included in the row count
        actionsToRedo = [];
        deletedRows.push(rowId);
        // "Disable" the row
        rowElement.find('td').css({
            'color': '#cccccc',
            'text-decoration': 'line-through'
        });
        // Disable the delete button
        $(this).addClass('disabled');
        updateToolbar();
        toolbarText.text('Row deleted!');
    });

    $('#openFolder').on('click', async function () {
        if (dbPath) {
            window.electron.send('open-folder', dbPath.substring(0, dbPath.lastIndexOf('/')));
        }
    });

    $('#saveInput').on('click', async function () {
        // Disable all buttons
        let buttons = document.getElementsByTagName('button');
        for (let i = 0; i < buttons.length; i++)
            buttons[i].classList.add('disabled');

        // Show a message to the user
        toolbarText.text('Saving changes...');

        // Modify the Jayvee Script and execute it
        for (let action of actionsDone)
            await window.electron.invoke(action[0], action[1]);
        window.electron.send('pipelineStart', null);
        await window.electron.on('pipelineFinished', (error) => {
            // Enable all buttons
            saveInputButton.classList.remove('disabled');
            undoButton.classList.remove('disabled');
            redoButton.classList.remove('disabled');
            let buttons = document.getElementsByTagName('button');
            for (let i = 0; i < buttons.length; i++)
                buttons[i].classList.remove('disabled');
            // Indicate success to the user
            toolbarText.text('Changes saved!');
            // Undo or redo is now not possible
            actionsDone = [];
            actionsToRedo = [];
            undoButton.classList.add('disabled');
            redoButton.classList.add('disabled');

            if (error) {
                toolbarText.text('Error saving changes');
            }
        });
    });

    $('#undo').on('click', async function () {
        toolbarText.text('Undoing last action...');
        const action = actionsDone.pop();
        if (action) {
            // Save action for redo
            actionsToRedo.push(action);
            if (action[0] == "removeColumn") {
                const columnIndex = action[1][0] + 1; // +1 because of the index column
                deletedColumns = deletedColumns.filter((value) => value !== columnIndex);
                // "Enable" the column text only if it's not crossed out by valuetype or row deletion
                for (let [key, crossedOutBy] of crossedOutRows) {
                    if (crossedOutBy?.length == 0 && !deletedRows.includes(key)) {
                        const cellElement = $(dataTable.cell(key - 1, columnIndex).node());
                        cellElement.css({
                            'color': '#000000',
                            'text-decoration': 'unset',
                        });
                    }
                }
                // Enable the delete button
                document.querySelector(`td:nth-child(${columnIndex + 1}) #deleteCol`)?.classList.remove('disabled'); // +1 because css index starts at 1
                // Enable buttons inside the header
                document.querySelector(`#headerTextField_${columnIndex}`)?.querySelectorAll('button').forEach(button => button.classList.remove('disabled'));
                // Enable the valuetype dropdown for this column
                const dropdown = document.getElementById(`dropdown-${columnIndex - 1}`) as HTMLSelectElement;
                dropdown.removeAttribute('disabled');
                // Enable statistics button
                const statisticsBtn = document.querySelector(`td:nth-child(${columnIndex + 1}) #viewStatistics`) as HTMLButtonElement;
                statisticsBtn.classList.remove('disabled');
            } else if (action[0] == "removeRow") {
                const rowId = action[1][0] - 1; // -1 because in Jayvee the header is included inm the row count
                deletedRows = deletedRows.filter((value) => value !== rowId);
                const rowElement = $(`#database tr[data-row-id="${rowId}"]`);
                rowElement.find('td').each(function (this: any, index: number) {
                    if (!deletedColumns.includes(index)) {
                        $(this).css({
                            'color': '#000000',
                            'text-decoration': 'unset'
                        });
                    }
                });
                // Enable the delete button
                rowElement.find('#deleteRow').removeClass('disabled');
            } else if (action[0] == "changeHeaderName") {
                const columnIndex = action[1][0] + 1; // +1 because of the index column
                const oldName = action[1][1];
                const inputElement = document.getElementById(`headerTextField_${columnIndex}`) as HTMLElement;
                const paragraph = inputElement.querySelector('p') as HTMLParagraphElement;
                const inputField = inputElement.querySelector('input') as HTMLInputElement;
                if (paragraph) {
                    paragraph.textContent = oldName;
                    inputField.value = oldName;
                }
                // Enable other buttons
                document.querySelector(`#headerTextField_${columnIndex}`)?.querySelectorAll('button').forEach(button => button.classList.remove('disabled'));
            } else if (action[0] == "saveValueType") {
                const columnIndex = action[1][0];
                const oldType = action[1][1];
                const dropdown = document.getElementById(`dropdown-${columnIndex}`) as HTMLSelectElement;
                dropdown.value = oldType;
                checkValueType(dropdown, columnIndex);
                modifyDisplay(dropdown, columnIndex);
                // Enable other buttons
                document.querySelector(`#headerTextField_${columnIndex}`)?.querySelectorAll('button').forEach(button => button.classList.remove('disabled'));
            }
        }
        updateToolbar();
        toolbarText.text('Last action undone!');
    });

    $('#redo').on('click', async function (this: any) {
        toolbarText.text('Restoring last action...');
        const action = actionsToRedo.pop();
        if (action) {
            // Restore action in actionsDone
            actionsDone.push(action);
            // Restore action in the UI
            if (action[0] == "removeColumn") {
                let columnIndex = action[1][0] + 1; // +1 because of the index column
                deletedColumns.push(columnIndex - 1);
                // "Disable" the column text
                $(dataTable.column(columnIndex).nodes()).css({
                    'color': '#cccccc',
                    'text-decoration': 'line-through'
                });
                // Disable the delete button
                document.querySelector(`td:nth-child(${columnIndex + 1}) #deleteCol`)?.classList.add('disabled'); // +1 because css index starts at 1
                // Disable buttons inside the header
                document.querySelector(`#headerTextField_${columnIndex}`)?.querySelectorAll('button').forEach(button => button.classList.add('disabled'));
                // Deactivate the valuetype dropdown for this column
                const dropdown = document.getElementById(`dropdown-${columnIndex - 1}`) as HTMLSelectElement;
                dropdown.setAttribute('disabled', 'true');
                // Disable statistics button
                const statisticsBtn = document.querySelector(`td:nth-child(${columnIndex + 1}) #viewStatistics`) as HTMLButtonElement;
                statisticsBtn.classList.add('disabled');
            } else if (action[0] == "removeRow") {
                const rowId = action[1][0] - 1; // -1 because in Jayvee the header is included inm the row count
                deletedRows.push(rowId + 1);
                const rowElement = $(`#database tr[data-row-id="${rowId}"]`);
                rowElement.find('td').css({
                    'color': '#cccccc',
                    'text-decoration': 'line-through'
                });
                // Disable the delete button
                rowElement.find('#deleteRow').addClass('disabled');
            } else if (action[0] == "changeHeaderName") {
                const columnIndex = action[1][0] + 1; // +1 because of the index column
                const newName = action[1][2];
                const inputElement = document.getElementById(`headerTextField_${columnIndex}`) as HTMLElement;
                const paragraph = inputElement.querySelector('p') as HTMLParagraphElement;
                const inputField = inputElement.querySelector('input') as HTMLInputElement;
                if (paragraph) {
                    paragraph.textContent = newName;
                    inputField.value = newName;
                }
            } else if (action[0] == "saveValueType") {
                const columnIndex = action[1][0];
                const newType = action[1][2];
                const dropdown = document.getElementById(`dropdown-${columnIndex}`) as HTMLSelectElement;
                dropdown.value = newType;
                checkValueType(dropdown, columnIndex);
                modifyDisplay(dropdown, columnIndex);
            }
        }
        updateToolbar();
        toolbarText.text('Last action restored!');
    });

    $('#createValuetype').on('click', async function (this: any) {
        // Create a dialog for the valutetypes
        const { overlay, dialog } = htmlHelpers.createDialog("valuetype", "Create new valutetype");
        $('body').append(overlay);
        $(overlay).append(dialog);
        toolbarText.text('');

        // Desctription
        const description = htmlHelpers.createParagraph('You can create a new valutetype with constraints. The constraints are used to filter or restrict the values of the columns. More about constraints can be read in the help section.');
        dialog.appendChild(description);

        // Name of the new valutetype
        const inputFiledDesctription = htmlHelpers.createParagraph('Enter the name of the new valutetype (Allowed characters are A-Z and a-z):');
        dialog.appendChild(inputFiledDesctription);
        const inputField = htmlHelpers.createInputElement(`valueTypeInput`, 'Name of the new valutetype', /^[A-Za-z]+$/, null, null);
        inputField.querySelector('button')?.remove();
        dialog.appendChild(inputField);

        // Choose the base valutetype
        const baseValueTypeDescription = htmlHelpers.createParagraph('Choose the base valutetype for the new valutetype:');
        dialog.appendChild(baseValueTypeDescription);
        const valueTypeDrowdown = htmlHelpers.createDropdown('baseValueType', baseValueTypes, null, false, false, null, () => {
            const dropdown = document.getElementById('baseValueType') as HTMLSelectElement;
            // Remove all elements after the dropdown if the user switches to another dropdown value
            let dropdownParent = dropdown.parentElement;
            if (dropdownParent) {
                let nextElement = dropdownParent.nextElementSibling;
                while (nextElement) {
                    const toRemove = nextElement;
                    nextElement = nextElement.nextElementSibling;
                    toRemove.remove();
                }
            }

            // Choose constraint
            const chooseConstraintDesctiption = htmlHelpers.createParagraph('Choose a constraint for the new valutetype:');
            dialog.appendChild(chooseConstraintDesctiption);
            let displayConstraints = createdConstraints.filter(constraint => constraint[1] === dropdown.value).map((constraint) => `${constraint[0]} oftype ${constraint[2]}`);
            const chooseConstraint = htmlHelpers.createDropdown('chooseConstraint1', displayConstraints, null, false, false, null, null);
            dialog.appendChild(chooseConstraint);

            // Add more constraints
            let cntConstraints = 1;
            const moreConstraints = htmlHelpers.createButton('moreConstraints', 'Add another constraint', null, () => {
                cntConstraints++;
                const linebreak = document.createElement('br');
                dialog.insertBefore(linebreak, moreConstraints);
                let displayConstraints = createdConstraints.filter(constraint => constraint[1] === dropdown.value).map((constraint) => `${constraint[0]} oftype ${constraint[2]}`);
                const additionalConstraint = htmlHelpers.createDropdown(`chooseConstraint${cntConstraints}`, displayConstraints, null, false, false, null, null);
                dialog.insertBefore(additionalConstraint, moreConstraints);
            });
            moreConstraints.style.marginTop = '5px';
            moreConstraints.style.marginBottom = '5px';
            dialog.appendChild(moreConstraints);
            const linebreak = document.createElement('br');
            dialog.appendChild(linebreak);

            const createButton = htmlHelpers.createButton('create', 'Create valutetype', null, () => {
                const inputValue = inputField.querySelector('input')?.value;
                // Check if the input is empty or contains invalid characters
                if (createdConstraints.length > 0) {
                    let constraintsChoosen = [];
                    if (inputValue === '' || !/^[A-Za-z]*$/.test(inputValue)) {
                        if (warning)
                            warning.textContent = 'Please enter a valid valutetype name';
                        return;
                    } else if (allowedValuetypes.includes(inputValue)) {
                        // Check if the valutetype already exists
                        if (warning)
                            warning.textContent = 'A valuetype whith the same name already exists';
                        return;
                    } else {
                        // Check if at least one constraint was selected
                        for (let i = 1; i <= cntConstraints; i++) {
                            const dropdown = document.getElementById(`chooseConstraint${i}`) as HTMLSelectElement;
                            if (dropdown.value !== 'Select an option') {
                                constraintsChoosen.push(dropdown.value.substring(0, dropdown.value.indexOf(' '))); //  Constraint name
                            }
                        }
                        if (constraintsChoosen.length === 0) {
                            // No option is selected
                            if (warning)
                                warning.textContent = 'Please select at least one constraint';
                            return;
                        }
                    }
                    // Everything is fine, send the new valutetype to the backend
                    let dropdown = document.getElementById(`baseValueType`) as HTMLSelectElement;
                    allowedValuetypes.push(inputValue);
                    createdValueTypes.push([inputValue, dropdown.value, constraintsChoosen]);
                    // Send the data to the backend
                    window.electron.send('createValuetype', [inputValue, dropdown.value, constraintsChoosen]);

                    // Update the display of the valuetypes
                    // Get the dropdown
                    columns.forEach((col: any, index: number) => {
                        const uniqueID = `dropdown-${index}`;
                        dropdown = document.getElementById(uniqueID) as HTMLSelectElement;
                        // Add new options
                        const option = document.createElement('option');
                        option.text = inputValue;
                        dropdown.appendChild(option);
                    });

                    // Show a message to the user
                    toolbarText.text('ValueType created!');
                    // Close the dialog
                    overlay.remove();
                    saveInputButton.classList.remove('disabled');
                }
            });
            dialog.appendChild(createButton);
            const warning = htmlHelpers.createParagraph('');
            warning.style.color = 'red';
            dialog.appendChild(warning);
            if (createdConstraints.length === 0) {
                if (warning)
                    warning.textContent = 'You have to create a constraint first!';
            }
        });
        dialog.appendChild(valueTypeDrowdown);
    });

    $('#createConstraint').on('click', async function (this: any) {
        const { overlay, dialog } = htmlHelpers.createDialog("newValuetype", "Create new constraint");
        $('body').append(overlay);
        $(overlay).append(dialog);

        // Description
        const description = htmlHelpers.createParagraph('You can create a new constraint type to filter or restrict values of columns. More about constraints can be read in the help section.');
        dialog.appendChild(description);

        // Create a constraint
        const constraintNameParagraph = htmlHelpers.createParagraph('Enter the name of the constraint (You can use A-Z, a-z and 0-9): ');
        dialog.appendChild(constraintNameParagraph);
        const constraintNameInput = htmlHelpers.createInputElement('newConstraintName', 'Name of the new constraint', /^[A-Za-z]+$/, null, null);
        constraintNameInput.querySelector('button')?.remove();
        constraintNameInput.querySelector('button')?.removeAllListeners();
        dialog.appendChild(constraintNameInput);

        // Base valutetype
        const baseValueTypeDescription = htmlHelpers.createParagraph('Choose the base valutetype for the new constraint:');
        dialog.appendChild(baseValueTypeDescription);
        const valueTypeDrowdown = htmlHelpers.createDropdown('baseValueType', baseValueTypes, null, false, false, null, () => {
            const dropdown = document.getElementById('baseValueType') as HTMLSelectElement;
            // Remove all elements after the dropdown if the user switches to another dropdown value
            let dropdownParent = dropdown.parentElement;
            if (dropdownParent) {
                let nextElement = dropdownParent.nextElementSibling;
                while (nextElement) {
                    const toRemove = nextElement;
                    nextElement = nextElement.nextElementSibling;
                    toRemove.remove();
                }
            }

            // Constraint type
            let allConstraints: string[] = [];
            let allConstraintsDescriptions: string[] = [];
            let allConstraintsPlaceholder: string[] = [];
            const selectedBaseValue = (document.getElementById("baseValueType") as HTMLSelectElement).value;
            if (selectedBaseValue === 'text') {
                allConstraints = ["Allowlist (Limits the values to a defined a set of allowed values. All values in the list are valid.)",
                    "Denylist (Defines a set of forbidden values)",
                    "Length (Limits the length of a string)",
                    "Regex (Limits the values complying with a regular expression)"];
                allConstraintsDescriptions = ["Allowed values separated by comma (e.g. ms, ns):", "Forbidden values separated by comma (e.g. ms, ns):",
                    "Minimum length, Maximum length:", "Regular expression (e.g. ^[a-zA-Z0-9]*$):"];
                allConstraintsPlaceholder = ["Values", "Values", "Min length", "Regular expression"];
            } else if (selectedBaseValue === "decimal" || selectedBaseValue === "integer") {
                allConstraints = ["Range (Limits the range of a number value)"];
                allConstraintsDescriptions = ["Lower bound, upper bound (both are inclusive):"];
                allConstraintsPlaceholder = ["Lower bound"];
            }
            const constraintList = htmlHelpers.createParagraph('Which kind of constraint do you want to create to append it to one or more columns?');
            dialog.appendChild(constraintList);
            const constraintListDropdown = htmlHelpers.createDropdown('constraintOptions', allConstraints, null, false, false, null, () => {
                const dropdown = document.getElementById('constraintOptions') as HTMLSelectElement;
                // Remove all elements after the dropdown if the user switches to another dropdown value
                let dropdownParent = dropdown.parentElement;
                if (dropdownParent) {
                    let nextElement = dropdownParent.nextElementSibling;
                    while (nextElement) {
                        const toRemove = nextElement;
                        nextElement = nextElement.nextElementSibling;
                        toRemove.remove();
                    }
                }
                // Show different input fields depending on the selected constraint
                const constraintChoosen = dropdown.selectedIndex - 1;
                // Create the input fields for the selected constraint
                let constraintChoosenText = htmlHelpers.createParagraph(allConstraintsDescriptions[constraintChoosen]);
                dialog.appendChild(constraintChoosenText);
                let constraintChoosenInput = htmlHelpers.createInputElement("constraintInput", allConstraintsPlaceholder[constraintChoosen], null, null, null);
                constraintChoosenInput.querySelector('button')?.remove();
                constraintChoosenInput.querySelector('button')?.removeAllListeners();
                dialog.appendChild(constraintChoosenInput);
                // Constraint has a secon input field
                if (selectedBaseValue === "decimal" || selectedBaseValue === "integer") {
                    dialog.appendChild(document.createElement('br'));
                    let constraintChoosenInput2 = htmlHelpers.createInputElement("constraintInput2", 'Upper bound', null, null, null);
                    constraintChoosenInput2.querySelector('button')?.remove();
                    constraintChoosenInput2.querySelector('button')?.removeAllListeners();
                    dialog.appendChild(constraintChoosenInput2);
                } else if (constraintChoosen === 2) {
                    dialog.appendChild(document.createElement('br'));
                    let constraintChoosenInput2 = htmlHelpers.createInputElement("constraintInput2", 'Max length', null, null, null);
                    constraintChoosenInput2.querySelector('button')?.remove();
                    constraintChoosenInput2.querySelector('button')?.removeAllListeners();
                    dialog.appendChild(constraintChoosenInput2);
                }

                // Check if everything is correctly filled out
                dialog.appendChild(document.createElement('br'));
                const warning = htmlHelpers.createParagraph('');
                warning.style.color = 'red';
                const button = htmlHelpers.createButton("createConstraint", "Create constraint", null, () => {
                    const inputs: HTMLInputElement[] = Array.from(dialog.querySelectorAll('input'));
                    const dropdowns: HTMLSelectElement[] = Array.from(dialog.querySelectorAll('select')); // Explicitly type dropdowns as an array of HTMLSelectElement
                    // Check if all inputs are filled
                    const allInputsFilled = inputs.every(input => input.value.trim() !== '');
                    // Check if all dropdowns have a selected option
                    const allDropdownsSelected = dropdowns.every(dropdown => dropdown.selectedIndex !== -1); // Fix the type error
                    if (!(allInputsFilled && allDropdownsSelected)) {
                        warning.textContent = 'Please fill out all fields!';
                        dialog.appendChild(warning);
                    } else {
                        let data = inputs[0].value;
                        if (!/^[A-Za-z]+$/.test(data)) {
                            warning.textContent = 'Name contains restricted characters.';
                        } else if (createdConstraints.map(constraint => constraint[0]).includes(data)) {
                            warning.textContent = 'A constraint with the same name already exists.';
                        } else if (selectedBaseValue === 'integer' || selectedBaseValue === 'decimal') { // Range constraint
                            let lowerBound = Number(inputs[1].value);
                            let upperBound = Number(inputs[2].value);
                            if (isNaN(lowerBound) || isNaN(upperBound)) {
                                warning.textContent = 'Lower bound and upper bound must be numbers.';
                            } else if (selectedBaseValue === 'integer' && lowerBound % 1 !== 0 && lowerBound % 1 !== 0) {
                                warning.textContent = 'Lower bound and upper bound must be integers.';
                            } else if (upperBound < lowerBound) {
                                warning.textContent = 'Upper bound must be greater than or equal to lower bound.';
                            } else {
                                warning.textContent = '';
                            }
                        } else {
                            if (constraintChoosen === 0) { //allowed values
                                data = inputs[1].value;
                                if (!/^[A-Za-z0-9, ]+$/.test(data)) {
                                    warning.textContent = 'Allowed values contains restricted characters.';
                                } else {
                                    warning.textContent = '';
                                }
                            } else if (constraintChoosen === 1) { //denied values
                                data = inputs[1].value;
                                if (!/^[A-Za-z0-9, ]+$/.test(data)) {
                                    warning.textContent = 'Denied values contains restricted characters.';
                                } else {
                                    warning.textContent = '';
                                }
                            } else if (constraintChoosen === 2) { //length
                                let minLength = Number(inputs[1].value);
                                let maxLength = Number(inputs[2].value);
                                if (isNaN(minLength) || isNaN(maxLength) || minLength % 1 !== 0 || maxLength % 1 !== 0) {
                                    warning.textContent = 'Min length and max length must be integers.';
                                } else if (maxLength < minLength) {
                                    warning.textContent = 'Max length must be greater than or equal to min length.';
                                } else if (minLength <= 0 || maxLength <= 0) {
                                    warning.textContent = 'Min length and max length must be greater than or equal to 0.';
                                } else {
                                    warning.textContent = '';
                                }
                            } else if (constraintChoosen === 3) { //regex
                                data = inputs[1].value;
                                if (!window.electron.invoke('checkRegex')) {
                                    warning.textContent = 'Invalid regex.';
                                } else {
                                    warning.textContent = '';
                                }
                            }
                        }
                        // Save the constraint if all warnings have been removed
                        if (warning.textContent === '') {
                            let dataToSend: any = [];
                            // Get all input fields and dropdowns in the dialog
                            const inputsAndDropdowns = dialog.querySelectorAll('input, select');
                            // Add the value of each input field or dropdown to
                            inputsAndDropdowns.forEach((element: HTMLElement) => {
                                if (element instanceof HTMLInputElement) {
                                    dataToSend.push(element.value);
                                } else if (element instanceof HTMLSelectElement) {
                                    dataToSend.push(element.options[element.selectedIndex].value);
                                }
                            });
                            // Show a message to the user
                            toolbarText.text('Constraint created!');
                            // Save the data in the software and a jayvee file
                            createdConstraints.push(dataToSend);
                            window.electron.send('createConstraint', dataToSend);
                            // Close the dialog
                            overlay.remove();
                            saveInputButton.classList.remove('disabled');
                        }
                    }

                });
                dialog.appendChild(button);
                dialog.appendChild(warning);
            });
            dialog.appendChild(constraintListDropdown);

        });
        dialog.appendChild(valueTypeDrowdown);
    });

    $('#viewConstraintsAndValuetypes').on('click', async function (this: any) {
        const { dialog, overlay } = htmlHelpers.createDialog("constraintsAndValuetypes", "Constraints and valuetypes");
        $('body').append(overlay);
        $(overlay).append(dialog);
        let createdValueTypesHtml = '<h2>Created Value Types</h2>';
        $(dialog).append(createdValueTypesHtml);
        if (createdValueTypes.length != 0) {
            createdValueTypes.forEach(valueType => {
                const p = htmlHelpers.createParagraph(`${valueType[0]} oftype ${valueType[1]} with constraints: ${valueType[2]}`);
                dialog.append(p);
            });
        } else {
            const p = htmlHelpers.createParagraph('No valuetypes created yet!');
            const linebreak = document.createElement('br');
            dialog.append(p);
            dialog.append(linebreak);
        }
        let createdConstraintsHtml = '<h2>Created Constraints</h2>';
        $(dialog).append(createdConstraintsHtml);
        if (createdConstraints.length != 0) {
            createdConstraints.forEach(constraint => {
                let p: HTMLParagraphElement | null = null;
                if (constraint[2].startsWith('Allowlist') || constraint[2].startsWith('Denylist')) {
                    p = htmlHelpers.createParagraph(`${constraint[0]} with base value ${constraint[1]} oftype Allowlist with values: ${constraint[3]}`);
                } else if (constraint[2].startsWith('Length')) {
                    p = htmlHelpers.createParagraph(`${constraint[0]} with base value ${constraint[1]} oftype Length with min length ${constraint[3]} and max length ${constraint[4]}`);
                } else if (constraint[2].startsWith('Range')) {
                    p = htmlHelpers.createParagraph(`${constraint[0]} with base value ${constraint[1]} oftype Range with lower bound ${constraint[3]} and upper bound ${constraint[4]}`);
                } else if (constraint[2].startsWith('Regex')) {
                    p = htmlHelpers.createParagraph(`${constraint[0]} with base value ${constraint[1]} oftype Regex with regex ${constraint[3]}`);
                }
                if (p != null) {
                    dialog.append(p);
                }
            });
        } else {
            const p = htmlHelpers.createParagraph('No constraints created yet');
            dialog.append(p);
        }
    });

    // Add an editable text field to the header which will be used to edit the column name
    $('#database thead th').each(function (this: HTMLElement, index: number) {
        // Only add the editable text field if the cell has text
        if (this.textContent && this.textContent.trim() !== '') {

            const uniqueId = `headerTextField_${index}`;
            toolbarText.text('If you edit anything, you can only use following characters: A-Z, a-z and 0-9');
            const editableTextField = htmlHelpers.createEditableParagraph(uniqueId, this.textContent, /^[A-Za-z0-9]*$/, 100, () => saveInput(uniqueId, 'changeHeaderName'));
            // Style the header text by moving buttons in a new line and removing the undo button, cause undo will be done by the undo button of the toolbar
            let inputField = editableTextField.querySelector('input');
            editableTextField.querySelector('#restore-button')?.remove();
            editableTextField.querySelector('#restore-button')?.removeAllListeners();

            if (inputField) {
                let br = document.createElement('br');
                inputField.parentNode.insertBefore(br, inputField.nextSibling);
            }
            this.textContent = ''; // Clear the current header text
            this.appendChild(editableTextField);
        }
    });



    // Enable/disable the toolbar buttons and text
    function updateToolbar() {
        if (actionsDone.length > 0) {
            undoButton.classList.remove('disabled');
        } else {
            undoButton.classList.add('disabled');
        }
        if (actionsToRedo.length > 0) {
            redoButton.classList.remove('disabled');
        } else {
            redoButton.classList.add('disabled');
        }
        saveInputButton.classList.remove('disabled');
        toolbarText.text('');
    }

    /** Function that is called when the user clicks save on an input element. It sends the new value to the background process.
    * @param {string} id - The id of the element that contains the input field and the paragraph.
    * @param {string} sendTo - The ipcRenderer channel to send the new value to.
    */
    function saveInput(id: string, sendTo: string) {
        const inputElement = document.getElementById(id) as HTMLElement;
        const inputField = inputElement.querySelector('input') as HTMLInputElement;
        const paragraph = inputElement.querySelector('p') as HTMLParagraphElement;
        const newValue = inputField.value.replace(' ', '\xa0');
        if (newValue !== '') {
            const oldValue = paragraph.textContent;
            // Get the index of the column
            let cell = document.getElementById(id)?.closest('th');
            let columnIndex = -1;
            if (cell) {
                columnIndex = cell.cellIndex;
            }
            paragraph.innerText = newValue;
            actionsDone.push([sendTo, [columnIndex - 1, oldValue, newValue]]); //-1 because of the index column
        } else {
            // Restore original text if input is empty
            if (paragraph.textContent)
                inputField.value = paragraph.textContent;
        }
        saveInputButton.classList.remove('disabled');
        undoButton.classList.remove('disabled');
    }


    /** Function that is called when the user changes a dropdown. It sends the new value to the background process.
    * @param {string} id - The id of the element that contains the input field and the paragraph.
    * @param {string} sendTo - The ipcRenderer channel to send the new value to.
    */
    const saveDropdown = (id: string, sendTo: string) => {
        let element = document.getElementById(id) as HTMLSelectElement;
        let data = element.value;
        let cell = document.getElementById(id)?.closest('td');
        let columnIndex = -1;
        if (cell) {
            columnIndex = cell.cellIndex;
        }
        actionsDone.push([sendTo, [columnIndex - 1, valuetypes[columnIndex - 1], data]]);//-1 because of the index column
        saveInputButton.classList.remove('disabled');
        undoButton.classList.remove('disabled');
    }

    // Create a dialog for the statistics
    $('#database').on('click', '#viewStatistics', async function (this: any) {
        // Get index and datatype of the column 
        const columnIndex = $(this).closest('td').get(0).cellIndex - 1; // -1 because of the index column
        const dropdown = document.getElementById(`dropdown-${columnIndex}`) as HTMLSelectElement;
        let datatype = dropdown.value;
        // Find the crossed out rows
        let filteredCrossedOutRows = [...crossedOutRows.keys()].filter(key => crossedOutRows.get(key)?.length ?? 0 > 0);
        // Check if the datatype is a base datatype or a created valuetype
        if (!baseValueTypes.includes(datatype) || datatype != 'boolean') {
            let valueType = createdValueTypes.find((valueType) => valueType[0] === datatype);
            if (valueType) {
                datatype = valueType[1];
            }
        }
        // Create the dialog
        const columnName = columns[columnIndex].title;
        const { overlay, dialog } = htmlHelpers.createDialog("statistic", `Statistics for column "${columnName}"`);

        // Get all the rows that are not deleted
        let columnValues = (await dbAll(`SELECT "${columnName}" FROM "${tableName}" WHERE rowid NOT IN (${deletedRows.join(',')})`)).map((row: { [x: string]: any; }) => row[columnName]);
        // Remove the crossed out rows
        filteredCrossedOutRows.sort((a, b) => b - a); // ensure that removing an element does not affect the indices of the elements that are removed later
        for (let i of filteredCrossedOutRows) {
            columnValues.splice(i - 1, 1);
        }

        if (columnValues.length === 0) {
            const p = htmlHelpers.createParagraph('No data available for statistics');
            dialog.appendChild(p);
        } else {
            // Adapt the data for the charts
            const counts = new Map();
            for (const value of columnValues) {
                counts.set(value, (counts.get(value) || 0) + 1);
            }
            const data = Array.from(counts, ([x, y]) => ({ x: x, y: Number(y) }));

            // Some statistics
            const numberOfEntries = columnValues.length;
            let paragraph = htmlHelpers.createParagraph(`Number of entries: ${numberOfEntries}`);
            dialog.appendChild(paragraph);
            dialog.appendChild(document.createElement('br'));
            const numberOfUniqueEntries = data.filter((entry: { x: any; y: number; }) => entry.y === 1).length;
            paragraph = htmlHelpers.createParagraph(`Number of unique entries: ${numberOfUniqueEntries}`);
            dialog.appendChild(paragraph);
            dialog.appendChild(document.createElement('br'));
            if (datatype === 'integer' || datatype === 'decimal') {
                const sum = columnValues.reduce((a: number, b: number) => a + b, 0);
                paragraph = htmlHelpers.createParagraph(`Sum: ${sum}`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
                const mean = sum / numberOfEntries;
                paragraph = htmlHelpers.createParagraph(`Mean: ${mean}`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
                const median = columnValues.sort((a: number, b: number) => a - b)[Math.floor(numberOfEntries / 2)];
                paragraph = htmlHelpers.createParagraph(`Median: ${median}`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
                const min = columnValues.reduce((a: number, b: number) => Math.min(a, b), Number.MAX_VALUE);
                const max = columnValues.reduce((a: number, b: number) => Math.max(a, b), Number.MIN_VALUE);
                const range = max - min;
                paragraph = htmlHelpers.createParagraph(`Data ranges from ${min} to ${max} (Range: ${range})`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
                // Calculate the outliers using the IQR method by calculating the first (Q1) and third (Q3) quartiles
                const sortedValues = columnValues.sort((a: number, b: number) => a - b);
                const q1 = sortedValues[Math.floor((sortedValues.length / 4))];
                const q3 = sortedValues[Math.floor((sortedValues.length * (3 / 4)))];
                // Calculate the interquartile range (IQR)
                const iqr = q3 - q1;
                // Any value less than Q1 - 1.5 * IQR or greater than Q3 + 1.5 * IQR is considered an outlier
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                const outliers = columnValues.filter((value: number) => value < lowerBound || value > upperBound);
                if (outliers.length > 0) {
                    paragraph = htmlHelpers.createParagraph(`Outliers: ${outliers}`);
                    dialog.appendChild(paragraph);
                    dialog.appendChild(document.createElement('br'));
                }
                // Calculate the variance
                const variance = columnValues.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / numberOfEntries;
                paragraph = htmlHelpers.createParagraph(`Variance: ${variance}`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
                // Calculate the standard deviation
                const standardDeviation = Math.sqrt(variance);
                paragraph = htmlHelpers.createParagraph(`Standard deviation: ${standardDeviation}`);
                dialog.appendChild(paragraph);
                dialog.appendChild(document.createElement('br'));
            }

            // create the bar chart with the frequency distribution
            // Sort the values
            // columnValues.sort((a: any, b: any) => columnValues.filter((v: any) => v === b).length - columnValues.filter((v: any) => v === a).length);
            const barPlot = htmlHelpers.createBarChart(data, `Frequency Distribution`);
            dialog.appendChild(barPlot);
        }
        $('body').append(overlay);
        $(overlay).append(dialog);
        toolbarText.text('');
    });

    window.electron.on('removeColumnResponse', (event, response) => {
        if (!response) {
            alert('Error deleting column');
        }
    });

    window.electron.on('changeHeaderResponse', (event, response) => {
        if (!response) {
            alert('Error renaming a header.');
        }
    });

    // Add the rows to the datatable
    window.electron.on('dbEachRow', (row) => {
        const rowData = Object.values(row);
        // Add the row data to the DataTable
        const rowNode = dataTable.row.add(rowData).draw(false).node();
        // Store the row ID as a data attribute on the row
        $(rowNode).attr('data-row-id', row.rowid);
        rowCount++;

        // Draw the DataTable after every N rows
        if (rowCount % drawAfterRows === 0) {
            dataTable.draw(false);
        }
    });

    window.electron.on('dbEachComplete', () => {
        // Draw the DataTable one final time to ensure all rows are displayed
        dataTable.draw(false);
    });

    // Load the data from the database. The data is loaded in chunks of 100 rows to improve performance
    let pageSize = 10;
    let offset = 0;
    setTimeout(async () => {
        await dbEach(`SELECT rowid, * FROM "${tableName}" LIMIT ${pageSize*10} OFFSET ${offset}`);
        offset += pageSize*10;
    }, 1);

    // If the user clicks on the next button, nerxt 100 rows are loaded
    dataTable.on('page', async function () {
        await dbEach(`SELECT rowid, * FROM "${tableName}" LIMIT ${pageSize*10} OFFSET ${offset}`);
        offset+=pageSize*10;
    });
});