/** Controls the UI when importing a new URL */

let dropdownsToBeSelected: { [id: string]: boolean } = {}
let valueTypes = ["text", "integer", "decimal", "boolean"];
let database: string = '';
let table: string = '';
const htmlHelper = window.electron.createHTMLElements;
/** 
* Listens for data from other process and creates a permanent text element.
* @param {string} id - The id of the text element.
* @param {string} data - The data to display in the UI.
* @param {string} output - Type of the data output element or null if just plain text should be displayed. 
*/
window.electron.on('createDataElement', (id, data, output) => {
  const formElement = document.getElementById('formElement');
  let paragraphElement;
  htmlHelper.removeElement('question');
  const path = data.substring(data.indexOf(':') + 2).trim();
  paragraphElement = htmlHelper.createParagraph(data);
  formElement?.appendChild(paragraphElement);
  if (output === "textWithFolder") {
    const openFolderButton = htmlHelper.createButton('openFolderButton', '', 'fa-folder-open', () => {
      openFolder([path]);
    });
    formElement?.appendChild(openFolderButton);
  }
  if (id === 'filePreviewData')
    paragraphElement.style.backgroundColor = 'gainsboro';
  formElement?.appendChild(document.createElement('br'));
});


/** 
* Listens for data from other process and creates a permanent text element along with an editable permanent text element.
* @param {string} id - The id of the editable text element or dropdown.
* @param {string} data - The data to display in the UI.
* @param {string} editableData - The data that is editable
* @param {number} numChars - The number of characters which can be inserted when editing the text or null.
* @param {string} allowedChars - The allowed characters to insert when editing the text or null.
* @param {string[]} editOptions - The dropdown options to display when the user clicks edit or null if an input field should be displayed.
*/
window.electron.on('createParagraphWithEditableText', (id, data, editableData, numChars, allowedChars, editOptions) => {
  const formElement = document.getElementById('formElement');
  let paragraphElement;
  paragraphElement = htmlHelper.createParagraph(data);
  formElement?.appendChild(paragraphElement);

  let editableParagraphElement;
  if (editOptions) {
    editableParagraphElement = htmlHelper.createDropdown(id, editOptions, editableData, true, true, dropdownsToBeSelected, recognizeSelectedOption);
    dropdownsToBeSelected[id] = false;
  } else {
    // Function that is called when the user clicks save. It sends the new value to the background process.
    function saveChanges() {
      const inputContainer = document.getElementById(id) as HTMLElement;
      const inputField = inputContainer.querySelector('input') as HTMLInputElement;
      const paragraph = inputContainer.querySelector('p') as HTMLParagraphElement;
      const newValue = inputField.value.replace(' ', '\xa0');
      if (newValue !== '') {
        paragraph.innerText = newValue;
        // Data has to be sent twice, cause different processes are listening for the data
        window.electron.send('sendDataToCSVImports', [id, newValue]);
        window.electron.send('sendChangesToCSVImports', [id, newValue]);
      } else {
        // Restore original text if input is empty
        if (paragraph.textContent)
          inputField.value = paragraph.textContent;
      }
    }
    editableParagraphElement = htmlHelper.createEditableParagraph(id, editableData, allowedChars, numChars, saveChanges);
    editableParagraphElement.querySelector('p').style.outline = '2px solid black';
  }
  formElement?.appendChild(editableParagraphElement);

  formElement?.appendChild(document.createElement('br'));
  htmlHelper.removeElement('question');
});

/**
 * Listen for data from other process and create a temporary text element.
* @param {string} question - The question to display in the UI.
* @param {boolean} error - True, if question should also be displayed as error dialog.
*/
window.electron.on('createQuestionElement', (question, error) => {
  const formElement = document.getElementById('formElement');
  if (error) {
    // Errors are only recognized after an input, so the event listeners are removed
    htmlHelper.removeElement('question');
    window.electron.showErrorDialog(question);
  }
  const questionElement = htmlHelper.createQuestionElement(question);
  formElement?.appendChild(questionElement);
});

/** 
* Listen for data from other process and create a pipeline start button.
* @param {string} id - The id of the button.
* @param {string} data - The text to display on the button.
*/
window.electron.on('createPipelineRunButton', (id, data) => {
  createPipelineRunButton(id, data);
});

/**
* Listen for data from other process and create a temporary input element.
* @param {string} id - The id of the input element.
* @param {string} placeholder- The palceholder to display in the UI.
* @param {string} allowedCharacters - The valid characters to enter in a text field or null.
*/
window.electron.on('createInputElement', (id, placeholder, allowedCharacters, maxChars) => {
  const formElement = document.getElementById('formElement');
  // Create the input element with button
  const inputElement = htmlHelper.createInputElement(id, placeholder, allowedCharacters, maxChars, sendData);
  // Append the input element to the output field
  formElement?.appendChild(inputElement);
});

/** Function to send data to the background process 
 * @param {string} element - Id of the element where the something was changed.
 * @param {any} data - The data to send.
*/
function sendData(element: string, data: any) {
  window.electron.send('sendDataToCSVImports', [element, data]);
}

/** 
* Listen for data from other process and create a dropdown element.
* @param {string[]} options - The dropdown options to display in the UI.
*/
window.electron.on('createDropdownElement', (id, options) => {
  const formElement = document.getElementById('formElement');
  const dropdownElement = htmlHelper.createDropdown(id, options, null, false, false, dropdownsToBeSelected, recognizeSelectedOption);
  dropdownsToBeSelected[id] = true;
  formElement?.appendChild(dropdownElement);
  formElement?.appendChild(document.createElement('br'));
});

/** 
* Listen for data from other process and remove elements
* @param {string} name - The name of the element to remove.
*/
window.electron.on('removeElement', name => {
  htmlHelper.removeElement(name);
});

/** Function to recognize selected option 
* @param {string} id - The id of the dropdown.
*/
function recognizeSelectedOption(id: string) {
  let element = document.getElementById(id) as HTMLSelectElement;
  let data = element.value;
  dropdownsToBeSelected[id] = false;
  // The data has to be sendt twice, cause different processes are listening for the data
  window.electron.send('sendDataToCSVImports', [id, data]);
  window.electron.send('sendChangesToCSVImports', [id, data]);
}

/** Function to create the pipeline run button again
* @param {string} id - The id of the button.
* @param {string} data - The text to display on the button.
*/
function createPipelineRunButton(id: string, data: string) {
  const formElement = document.getElementById('formElement');
  let buttonElement = htmlHelper.createButton(id, data, '', () => {
    if (data === 'Try to import again') {
      const failMSG = document.getElementById("redCross");
      failMSG?.remove();
    }
    // Check if all dropdowns have been selected
    let dropdownsSelected = true;
    for (const id in dropdownsToBeSelected) {
      if (dropdownsToBeSelected[id]) {
        // If any dropdwon has not been selected yet
        dropdownsSelected = false;
        window.electron.showErrorDialog('Please select an option for all dropdowns!');
        break;
      }
    }
    if (dropdownsSelected) {
      // Create a running animation until the pipeline has finished
      const runningAnimation = document.createElement('span');
      runningAnimation.textContent = 'Executing the import...'; // Display a running animation text
      buttonElement.parentNode?.replaceChild(runningAnimation, buttonElement);

      // Disable all action buttons except viewDatabase button
      const buttons = document.getElementsByClassName('action-button');
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].id !== 'viewDatabase' || buttons[i].id !== 'openFolderButton') {
          buttons[i].classList.add('disabled');
        }
      }
      // Disable all dropdowns
      const dropdowns = document.getElementsByTagName('select');
      for (let i = 0; i < dropdowns.length; i++) {
        dropdowns[i].disabled = true;
      }

      // Send the signal to start the pipeline
      window.electron.send('pipelineStart', null);

      /** Listen for pipeline finish event
      * @param {boolean} error - True, if an error occurred during the pipeline execution. 
      * @param {directory} - The directory where the data was stored or null.
      * @param {string} database - The name of the database where the data was stored or null.
      * @param {string} table - The name of the table where the data was stored or null.
      */
      window.electron.on('pipelineFinished', (error, [directory, database, table]) => {
        // Reomve the previous created button if this method is called twice or multiple times
        const oldPipelineRunButton = document.getElementById('pipelineRunButton');
        oldPipelineRunButton?.remove();
        const oldViewDatabaseButton = document.getElementById('viewDatabase');
        oldViewDatabaseButton?.remove();
        if (error) {
          // Replace the running animation with a red cross when the pipeline fails
          const redCross = document.createElement('span');
          redCross.id = 'redCross';
          redCross.textContent = '❌';
          runningAnimation.parentNode?.replaceChild(redCross, runningAnimation);
          const errorMSG = htmlHelper.createParagraph(`An error occurred during the data import. Please verify that all parameters are configured correctly.`);
          redCross.appendChild(errorMSG);
          // Add the button again to allow the user to try again
          createPipelineRunButton('pipelineRunButton', 'Try to import again');
          // Enable all action buttons
          const buttons = document.getElementsByClassName('action-button');
          for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].id !== 'viewDatabase' || buttons[i].id !== 'openFolderButton') {
              buttons[i].classList.remove('disabled');
            }
          }
          // Enable all dropdowns
          const dropdowns = document.getElementsByTagName('select');
          for (let i = 0; i < dropdowns.length; i++) {
            dropdowns[i].disabled = false;
          }

        } else {
          // Replace the running animation with a green tick when the pipeline finishes
          const greenTick = document.createElement('span');
          greenTick.id = 'greenTick';
          greenTick.textContent = '✅';
          runningAnimation.parentNode?.replaceChild(greenTick, runningAnimation);
          const msg = htmlHelper.createParagraph(`The data was successfully stored into a database. You can view the database by clicking the button below. The database can also be edited in the database view.`);
          greenTick.appendChild(msg);
          // Create a button to view the database
          let viewDatabaseButton = htmlHelper.createButton('viewDatabase', 'View Database', '', () => {
            cleanup();
            window.electron.send('viewDatabase', [`${directory}/${database}.sqlite`, table]);
          });
          formElement?.appendChild(document.createElement('br'));
          formElement?.appendChild(viewDatabaseButton);
        }
      });
    }
  });
  formElement?.appendChild(buttonElement);
}





/** Opens the specified folder path in the default file explorer.
 * @param {any[]} vars - Contains the folder path.
 */
function openFolder(vars: any[]): void {
  window.electron.send('open-folder', vars[0]);
}


// Ensure DOM content is loaded before accessing elements
document.addEventListener('DOMContentLoaded', (event) => {
  //Start the creation of a new project
  window.electron.send('createNewProject', null);
});

// Cleanup function to remove all event listeners and reset all variables
function cleanup() {
  // Remove all event listeners
  window.electron.removeListener('createDataElement', () => {});
  window.electron.removeListener('createParagraphWithEditableText', () => {});
  window.electron.removeListener('createQuestionElement', () => {});
  window.electron.removeListener('createPipelineRunButton', () => {});
  window.electron.removeListener('createInputElement', () => {});
  window.electron.removeListener('createDropdownElement', () => {});
  window.electron.removeListener('pipelineFinished', () => {});

  // Reset all variables and parameters
  dropdownsToBeSelected = {};
  valueTypes = ["text", "integer", "decimal", "boolean"];
  database = '';
  table = '';

  // Remove all form elements
  const formElement = document.getElementById('formElement');
  while (formElement?.firstChild) {
    formElement.removeChild(formElement.firstChild);
  }
}