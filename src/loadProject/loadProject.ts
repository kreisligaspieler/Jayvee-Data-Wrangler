/** Displays a list of all projects*/

const createHTMLElements = window.electron.createHTMLElements;
displayProjects();

// Display all projects in workspace
async function displayProjects() {
    let workspaceFolders = await window.electron.invoke('getFoldersInWorkspace');
    let projectList = document.getElementById('projectsList');
    if (workspaceFolders === null || workspaceFolders.folders.length === 0) {
        let message = createHTMLElements.createParagraph('No projects found in the workspace. Please create a new project.');
        projectList?.appendChild(message);
    } else {
        let message = createHTMLElements.createParagraph('Please select a project to load by clicking on the name:');
        projectList?.appendChild(message);
        projectList?.appendChild(document.createElement("br"));
        for (let project of workspaceFolders.folders) {
            let projectItem = createHTMLElements.createClickableParagraph(project, () =>
                window.electron.send('viewDatabase', [`${workspaceFolders.workspace}/${project}/${project}.sqlite`, project])
            );

            projectList?.appendChild(projectItem);
            projectList?.appendChild(document.createElement("br"));
        }
    }
}



