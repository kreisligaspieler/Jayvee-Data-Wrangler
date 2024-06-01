window.addEventListener('DOMContentLoaded', async (event) => {
  const dirname: string = window.electron.getDirname();

  try {
    const response = await fetch(`${dirname}/src/header/header.html`);
    const data: string = await response.text();

    const headerElement: HTMLElement | null = document.getElementById('header');
    if (headerElement) {
      headerElement.innerHTML = data;

      // Set the src attribute of the img tag
      const logoImage: HTMLImageElement | null = document.querySelector('img');
      if (logoImage) {
        logoImage.src = `${dirname}/assets/logo.svg`;
      }

      // Handle the "Home" link click event
      const homeLink = document.querySelector('a[href="app.html"]');
      if (homeLink) {
        homeLink.addEventListener('click', (event) => {
          event.preventDefault();
          window.electron.send('home', {});
        });
      }

       // Handle the "about" link click event
       const about = document.querySelector('a[href="about.html"]');
       if (about) {
        about.addEventListener('click', (event) => {
           event.preventDefault();
           window.electron.send('help', {});
         });
       }
    }
  } catch (error) {
  }
});
