window.addEventListener('DOMContentLoaded', async (event) => {
    const dirname: string = window.electron.getDirname();

    try {
        const response = await fetch(`${dirname}/src/footer/footer.html`);
        const data: string = await response.text();

        const footerElement: HTMLElement | null = document.getElementById('footer');
        if (footerElement) {
            footerElement.innerHTML = data;
        }
    } catch (error) {
    }
});
