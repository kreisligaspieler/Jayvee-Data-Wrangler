/** This file is used to create HTMLElements for the UI*/
import * as chart from 'chart.js';


/** Creates a temporary paragraph, typically a question asked to the user.
 * @param {string} questionText 
 * @returns {HTMLParagraphElement} - The created question element.
 */
export function createQuestionElement(questionText: string) {
    const questionElement = document.createElement('p');
    questionElement.classList.add('formText');
    questionElement.id = 'question';
    questionElement.setAttribute('i18n', '');
    questionElement.textContent = questionText;
    return questionElement;
}


/**
* Creates a dropdown.
* @param {string} id - The id of the dropdown.
* @param {string[]} options - The options to display in the dropdown.
* @param {string} preselected - The option to preselect in the dropdown or null.
* @param {boolean} inline - True, if the dropdown should be displayed inline.
* @param {boolean} restore - True, if the dropdown should have a restore option.
* @param {string[]} dropdownsToBeSelected - Array to store which dropdowns are selected or null.
* @param {function} onChange - Function to call when the dropdown changes or null.
* @returns {HTMLElement} - The container element with text and dropdown.
*/
export function createDropdown(id: string, options: string[], preselected: string | null, inline: boolean, restore: boolean,
    dropdownsToBeSelected: { [id: string]: boolean }, onChange: (id: string) => void): HTMLElement {
    const dropdownContainer = document.createElement('div');
    if (inline)
        dropdownContainer.style.display = 'inline-block';
    dropdownContainer.classList.add('dropdown-container');
    const select = document.createElement('select');
    select.id = id;

    // Add a default "Select an option" option
    const defaultOption = document.createElement('option');
    defaultOption.text = 'Select an option';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });

    if (preselected && options.includes(preselected))
        select.value = preselected;
    if (dropdownsToBeSelected) {
        // If preselected is not null and is included in the options list, select it
        if (preselected && options.includes(preselected)) {
            // Set dropdown as selected
            dropdownsToBeSelected[id] = false;
        } else {
            dropdownsToBeSelected[id] = true;
        }
    }
    dropdownContainer.appendChild(select);

    // Create Font Awesome restore
    if (restore) {
        const restoreButton = createButton('restore-button', '', 'fa-undo', () => handleRestoreClick());
        function handleRestoreClick() {
            if (preselected && options.includes(preselected)) {
                select.value = preselected;
                select.focus();
                if (onChange) {
                    onChange(id);
                }
            }
        }
        dropdownContainer.appendChild(restoreButton);
    }
    if (onChange)
        dropdownContainer.addEventListener('change', () => onChange(id));
    return dropdownContainer;
}



/** Deletes an element.
 * @param {string} id - The id of the element to delete.
*/
export function removeElement(id: string) {
    // Get the element
    const element = document.getElementById(id);
    // Check if the element exists
    if (element) {
        // Remove the element
        element.remove();
    }
}

/** Creates a paragraph with text inside.
 * @param {string} text - The text to display.
 * @returns {HTMLDivElement} - The created paragraph element.
*/
export function createParagraph(text: string) {
    const container = document.createElement('div');
    container.style.display = 'inline-block';
    container.id = 'text';
    const paragraph = document.createElement('p');
    paragraph.classList.add('formText');
    paragraph.textContent = text;
    paragraph.innerHTML = text.replace(/ /g, '&nbsp;');
    container.appendChild(paragraph);
    return container;
}

/** Creates a paragraph with text inside which executes a function on click.
 * @param {string} text - The text to display.
 * @param {() => void} onClick - The function to execute on click.
 * @returns {HTMLDivElement} - The created paragraph element.
 */
export function createClickableParagraph(text: string, onClick: () => void) {
    const paragraph = createParagraph(text);
    paragraph.style.cursor = 'pointer';
    paragraph.onclick = onClick;
    return paragraph;
}

/**
 * Creates a paragraph element with buttons that becomes editable on click and saves changes.
 * @param {string} id - The id of the paragraph element or null.
 * @param {string} text - The initial text content.
 * @param {RegExp} allowedChars - The allowed characters for the input field or null.
 * @param {number} maxChars - The number of characters allowed in the input field or null.
 * @param {function} saveChanges - The function to call when the text is saved. 
 * @returns {HTMLDivElement} - The created paragraph element container.
 */
export function createEditableParagraph(id: string, text: string, allowedChars: RegExp, maxChars: number, saveChanges: () => void): HTMLDivElement {
    // Create container element which holds the paragraph, input field and buttons
    const container = document.createElement('div');
    container.style.display = 'inline-block';
    container.id = id;

    // Create paragraph element
    const paragraph = document.createElement('p');
    paragraph.style.padding = '2px';
    paragraph.textContent = text;
    showParagraph();
    container.appendChild(paragraph);

    // Create input element
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.value = text;
    if (maxChars)
        inputElement.maxLength = maxChars;
    hideInputField();
    container.appendChild(inputElement);

    // Create edit button
    const edit = createButton('edit-button', '', 'fa-pencil-alt', () => handleEditClick());
    container.appendChild(edit);

    // Create restore button
    const restore = createButton('restore-button', '', 'fa-undo', () => handleRestoreClick());
    container.appendChild(restore);

    // Create save button
    const save = createButton('save-button', '', 'fa-save', () => handleSaveClick());
    hideSaveButton();
    container.appendChild(save);

    // Create cancel button
    const cancel = createButton('cancel-button', '', 'fa-times', () => handleCancelClick());
    hideCancelButton();
    container.appendChild(cancel);


    function handleEditClick() {
        showInput();
    }

    // Saves the input if it doesn't contain restricted characters
    function handleSaveClick() {
        const data = inputElement.value;
        if (data.length > 0 && allowedChars && !allowedChars.test(data)) {
            // Remove old warning if exists and create new warning
            removeElement('questionWarning');
            const container = document.getElementById(id);
            const question = createQuestionElement('Input contains restricted characters.');
            question.id = 'questionWarning';
            question.style.color = 'red';
            container?.appendChild(question);
        } else if (data.length > 0) {
            saveChanges();
            showText();
            removeElement('questionWarning');
        }

    }
    
    // Restores the original value
    function handleRestoreClick() {
        paragraph.textContent = text;
        inputElement.value = text;
        inputElement.focus();
        saveChanges();
        showText();
        removeElement('questionWarning');
    }

    // Aborts the changes
    function handleCancelClick() {
        abortChanges();
        removeElement('questionWarning');
    }

    // Function to handle enter key press to save value
    function handleInputKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            const data = inputElement.value;
            if (data.length > 0 && allowedChars && !allowedChars.test(data)) {
                removeElement('questionWarning');
                const container = document.getElementById(id);
                const question = createQuestionElement('Input contains restricted characters.');
                question.id = 'questionWarning';
                question.style.color = 'red';
                container?.appendChild(question);
            } else if (data.length > 0) {
                saveChanges();
                showText();
                removeElement('questionWarning');
            }
        }
    }

    // Function to handle escape key press
    function handleEscapeKeyPress(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            abortChanges();
        }
    }

    function showEditButton() {
        edit.style.display = 'inline';
    }

    function hideEditButton() {
        edit.style.display = 'none';
    }

    function showSaveButton() {
        save.style.display = 'inline';
    }

    function hideSaveButton() {
        save.style.display = 'none';
    }

    function showCancelButton() {
        cancel.style.display = 'inline';

    }

    function hideCancelButton() {
        cancel.style.display = 'none';
    }

    function showInputField() {
        inputElement.style.display = 'inline';
        inputElement.focus();
        inputElement.addEventListener('keypress', handleInputKeyPress);
        inputElement.addEventListener('keydown', handleEscapeKeyPress);
        hideParagraph();
    }

    function hideInputField() {
        inputElement.style.display = 'none';
        inputElement.removeEventListener('keypress', handleInputKeyPress);
    }

    function showParagraph() {
        paragraph.style.display = 'inline';
    }

    function hideParagraph() {
        paragraph.style.display = 'none';
    }

    //Shows the text, edit and restore button
    function showText() {
        hideInputField();
        hideSaveButton();
        hideCancelButton();
        showParagraph();
        showEditButton();
    }

    //Shows inpout field, save and cancel button
    function showInput() {
        hideEditButton();
        showInputField();
        showSaveButton();
        showCancelButton();
    }

    function abortChanges() {
        // Restore original text
        if (paragraph.textContent)
            inputElement.value = paragraph.textContent;
        hideInputField();
        showText();
    }
    return container;
}


/** Helper function to create buttons
 * @param {string} id - The id of the button.
 * @param {string} text - The text to display on the button.
 * @param {string} icon - The Font Awesome icon to display on the button or null.
 * @param {() => void} onClick - The function to call when the button is clicked or null if the listener is added later.
 * @returns {HTMLDivElement} - The created button.
 */
export function createButton(id: string, text: string, icon: string, onClick: () => void) {
    // If a failure message is displayed and a button is clicked again, remove it
    const button = document.createElement('button');
    button.id = id;
    button.classList.add('action-button');
    button.textContent = text;
    if (icon) {
        // Create the icon element
        const iconElement = document.createElement('i');
        iconElement.classList.add('fas', icon);
        // Append the icon element to the button
        button.appendChild(iconElement);
    }
    if (onClick)
        button.addEventListener('click', onClick);
    return button;
}

/** Creates an input element with a submit button.
 * @param {string} id - The id of the input element.
 * @param {string} placeholder - The placeholder text for the input element.
 * @param {RegExp} allowedChars - The allowed characters for the input element.
 * @param {number} maxChars - The maximum number of characters allowed in the input element or null.
 * @param {function} callback - The function to call when the button is clicked.
 * @returns {HTMLDivElement} - The created input element.
*/
export function createInputElement(id: string, placeholder: string, allowedChars: RegExp, maxChars: number, callback: (id: string, data: string) => void) {
    const container = document.createElement('div');
    container.id = id;
    // Create the input element
    const inputElement = document.createElement('input');
    inputElement.id = `input`;
    inputElement.type = 'text';
    inputElement.classList.add('formInput');
    inputElement.placeholder = placeholder;
    if (maxChars)
        inputElement.maxLength = maxChars;
    container.appendChild(inputElement);
    // Create the button element
    const buttonContainer = createButton(`button`, '', 'fa-paper-plane', () => handleInputButtonClick(id, allowedChars, callback));
    inputElement.addEventListener('keypress', (event) => handleKeyPress(event, id, allowedChars, callback));
    container.appendChild(buttonContainer);
    return container;
}

/** Function to handle button click events 
 * @param {string} id - The id of the container its input element shoud be used. 
 * @param {RegExp} allowedChars - The allowed characters for the input element.
 * @param {function} callback - The function to execute when the button is clicked.
 */
function handleInputButtonClick(id: string, allowedChars: RegExp, callback: (id: string, data: string) => void) {
    const divElement = document.getElementById(id);
    if (divElement) {
        const inputElement = divElement.querySelector(`input`) as HTMLInputElement;
        if (inputElement) {
            const data = inputElement.value;
            if (data.length > 0 && allowedChars && !allowedChars.test(data)) {
                removeElement('questionWarning');
                const container = document.getElementById(id);
                const question = createQuestionElement('Input contains restricted characters.');
                question.id = 'questionWarning';
                question.style.color = 'red';
                container?.appendChild(question);
            } else if (data.length > 0) {
                callback(id, data);
                removeElement(id);

            }
        }
    }
}

/** Function to handle enter-key press events 
 * @param {KeyboardEvent} event - The key press event.
 * @param {string} id - The id of the element to take the input from.
 * @param {RegExp} allowedChars - The allowed characters for the input element.
 * @param {Function} callback - The function to execute when the enter key is pressed.
 */
function handleKeyPress(event: KeyboardEvent, id: string, allowedChars: RegExp, callback: (id: string, data: string) => void) {
    if (event.key === 'Enter') {
        const divElement = document.getElementById(id);
        if (divElement) {
            const inputElement = divElement.querySelector(`input`) as HTMLInputElement;
            if (inputElement) {
                const data = inputElement.value;
                if (data.length > 0 && allowedChars && !allowedChars.test(data)) {
                    removeElement('questionWarning');
                    const container = document.getElementById(id);
                    const question = createQuestionElement('Input contains restricted characters.');
                    question.id = 'questionWarning';
                    question.style.color = 'red';
                    container?.appendChild(question);
                } else if (data.length > 0) {
                    callback(id, data);
                    removeElement(id);
                }
            }
        }
    }
}

/** Creates an empty dialog with a close button 
 * @param {string} id - The id of the modal.
 * @param {string} title - The title of the modal.
 * @returns {{HTMLDivElement, HTMLDivElement}} - An overlay and dialog element.
 */
export function createDialog(id: string, title: string) {
    // Create the overlay
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';

    const dialogTitle = document.createElement('h2');
    dialogTitle.textContent = title;
    dialog.appendChild(dialogTitle);

    // Create the close button
    const closeButton = createButton('dialog-close-button', '', 'fa-times', () => overlay.remove());

    // Append the close button to the dialog
    dialog.appendChild(closeButton);

    return { overlay, dialog };
}


chart.Chart.register(chart.BarController, chart.LinearScale, chart.CategoryScale, chart.BarElement, chart.Title, chart.Tooltip, chart.Legend);

/** Create a Bar Chart
 * @param {{number|string, number}[]} data - The data points to display.
 * @param {string} title - The title of the chart.
 * @returns {HTMLCanvasElement | undefined} - The canvas element of the Chart.js instance.
 */
export function createBarChart(data: { x: number | string, y: number }[], title: string): HTMLCanvasElement | undefined {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        new chart.Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(({ x }) => x),
                datasets: [{
                    data: data.map(({ y }) => y),
                    backgroundColor: '#007bff',
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: { type: 'category', display: true },
                    y: { type: 'linear', beginAtZero: true }
                }
            }
        });
        return canvas;
    }
    return undefined;
}

