document.addEventListener('DOMContentLoaded', (event) => {
    const newProjectBtn: HTMLElement | null = document.querySelector('#newProjectBtn');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', (event) => {
            window.electron.send('newProject', {});
        });
    }
    const loadProjectBtn: HTMLElement | null = document.querySelector('#loadProjectBtn');
    if (loadProjectBtn) {
        loadProjectBtn.addEventListener('click', (event) => {
            window.electron.send('loadProject', {});
        });
    }
    const helpBtn: HTMLElement | null = document.querySelector('#helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', (event) => {
            window.electron.send('help', {});
        });
    }
});
