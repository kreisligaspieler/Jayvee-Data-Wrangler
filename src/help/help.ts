/* This file creates the help page. All actions a user can do are described as well as the licence of the Jayvee Data Wrangler shown. */

$(document).ready(async function () {
    let wrapper = document.getElementById('help');
    if(wrapper)
    wrapper.innerHTML = `<h1 id="welcome-to-the-jayvee-data-wrangler-">Welcome to the Jayvee Data Wrangler</h1>
    <p>This software originated from a master's thesis, which aims to provide a free and open-source software to help researchers and data scientists with data wrangling tasks. The software is designed to be user-friendly. It's designed to help you with data wrangling tasks and automatically create executable scripts for Jayvee. If you have any questions or feedback, please feel free to contact me via E-Mail (jdw@derwebmaster.eu) or GitHub. I hope you enjoy using the Jayvee Data Wrangler!</p>
    <h1 id="how-to-use-">How to use it?</h1>
    <p>Apart from importing data from a CSV on the internet into a SQLite database, you can also clean and filter the imported data, and view your previously imported projects. During the import or modification of data, a pipeline.jv file is created. The script contains executable code (Jayvee DSL language). The content of the CSV is imported into the database, as well as modified using this script. Programmers can also modify and execute it using the DSL Jayvee. Further information about Jayvee can be found in the official documentation: https://jvalue.github.io/jayvee/</p>
    <h2 id="1-load-data">1. Load Data</h2>
    <p>You can import data from a CSV file via a URL into a SQLite database. You will be guided through the import process step by step. First, you will have to create a new project. The underlying procedure will create a folder in a workspace-folder that is located inside the application configuration files (e.g. ∼/.config/jayvee−data−wrangler/workspace/example on Linux or C:\Users\YourUsername\AppData\Roaming\jayvee-data-wrangler\ on Windows). Keep in mind that you have to choose different project names, as the software does not override existing folders. After this, you can proceed with the data import. As far as possible, all metadata and the header will be detected automatically. If at any point something's not detected automatically, you can manually adjust the settings. You can adjust the following parameters:</p>
    <ul>
        <li>Encoding: Every CSV file is encoded in a special format. If the encoding is not supported or not recognized automatically, a dropdown with all supported encodings you can choose from is shown.</li>
        <li>Delimiter: A character that distinguishes the entries within a row. If it is automatically detected but not visible, it may be the space character that goes unnoticed. Typical delimiters are ',', ';', '\t', '|', ':', ' ', but you can set any character as a delimiter.</li>
        <li>Enclosing: A character that serves the purpose of enclosing the entries within a row. Typical enclosing characters are " and ', but it is possible that there is no enclosing character. You can also set any character as enclosing, but it has to differ from the delimiter.</li>
    </ul>
    <p>If the header is not detected, the software automatically creates column names. Also, duplicate column names are automatically renamed by adding unique numbers. Note that detecting metadata and importing the CSV into a database might take some time.</p>
    <h2>2. Open Project Folder</h2>
    <p>You can open the project folder in the system's file explorer with a button click. Inside the project folder there are a Jayvee file (pipeline.jv), the database, a metadata database and the CSV file. You can modify the database, but keep in mind that changes to the database are visible in the Jayvee Data Wrangler when a project is loaded, as it loads the contents of the database. Once a CSV has been imported into a database, modifying the Jayvee file or CSV file has no influence on the data (if you don't execute the Jayvee file) and therefore not on the behavior of the Jayvee Data Wrangler. Please don't modify the metadata database.</p>
    <h2 id="2-view-database-clean-data">3. View Database/ Clean Data</h2>
    <p>After successfully importing a CSV into a database (or if you view existing projects), you can clean your data by removing columns and rows, renaming headers, changing value types of columns and creating custom value types with custom constraints. In particular, custom value types enable a wide range of data filtering options. You will see all changes immediately. The changes you make will only affect the database and the ETL pipeline when you save them.</p>
    <p>You can make the following changes by clicking on the respective button:</p>
    <ul>
        <li>Edit column names: You can rename a column header using the letters a-z and A-Z</li>
        <li>Delete columns and rows</li>
        <li>Create custom value types with custom constraints to filter the data</li>
        <li>Change the value type of a column&nbsp;</li>
    </ul>
    <h2 id="3-create-custom-value-types-with-custom-constraints">4. Create Custom Value Types with Custom Constraints</h2>
    <p>You can create custom value types with custom constraints. This enables a wide range of data filtering options. You will be guided through the process of creating custom value types with constraints. After creating these, you will be able to use value types for filtering the data of a column. Note: You have to create constraints first to use them with your custom value types. The constraints are also saved within the metadata database in the project folder.</p>
    <p>Constraints have a built in value type (text, integer or decimal) and a constraint. They have to be chosen from one of the following:</p>
    <ul>
        <li>Regular expressions</li>
        <li>List of allowed values</li>
        <li>List of denied values</li>
        <li>Range constraints</li>
        <li>Length constraints</li>
    </ul>
    <p>These constraints restrict the possible values of a value type. After creating a constraint, a value type can be created. Value types have a built-in value type and one or more constraints of the same built-in value type.</p>
    <p>You can read more about constraints and value types in the Jayvee documentation: https://jvalue.github.io/jayvee/docs/category/constraint-types</p>
    <h2 id="4-visualize-data-statistics">5. Visualize Data/ Statistics</h2>
    <p>To get a better understanding of the data, statistics are created for every column depending on the datatype of the column by clicking the statistics button of a column.</p>
    <h2 id="7-save-changes">6. Delete Rows or Columns</h2>
    <p>You can delete rows or columns by clicking the respective delete button.&nbsp;</p>
    <h2 id="7-save-changes">7. Save Changes</h2>
    <p>All changes made to the database are temporary and can be undone until you click the save button. The changes are saved in the original database and original ETL pipeline within your project folder. If you want to keep previous versions of the database and ETL pipeline, you have to copy the files to another folder or duplicate the project folder.</p>
    <p>If an error occurs during saving, you can undo changes and try saving again or abort the changes by navigating to the home page.</p>
    <h2 id="6-open-previous-projects">8. Open Previous Projects</h2>
    <p>You can open previous projects from the start page. The projects are saved in the workspace directory. All folders within the workspace are interpreted as projects. An opened project can then be edited (e.g. delete rows, create value types).</p>
    <h2>9. Delete Projects</h2>
    <p>Projects can be deleted by removing their project folder from the file system using the operating system's file explorer.&nbsp;</p>
    <h2 id="8-disclaimer">10. Disclaimer</h2>
    <p>The Jayvee Data Wrangler is provided 'as is', without any warranty. You are responsible for all inputs. If you insert a URL, the Jayvee Data Wrangler downloads the file the URL points to your device. You are responsible for checking the URL and the content of the file before you use it in this software.</p>
    <h1 id="license">License</h1>
    <p>The Jayvee Data Wrangler is a free software. It is licensed under the MIT License. This means you can use, modify, and distribute the software as you wish. However, the software is provided 'as is', without any warranty. For more information, please visit the GitHub repository.</p>
    <p>&nbsp;</p>`});