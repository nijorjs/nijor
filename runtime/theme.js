export function setTheme(theme) {
    if (theme === "normal") {
        document.body.removeAttribute('theme');
        window.localStorage.setItem('theme', 'normal');
        return;
    }

    if (theme === "auto") {
        window.localStorage.setItem('theme', 'auto');
        let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) document.body.setAttribute('theme', 'dark');
        else document.body.removeAttribute('theme');
        return;
    }

    window.localStorage.setItem('theme', theme);
    document.body.setAttribute('theme', theme);

}

export function autoTheme() {

    const Theme = window.localStorage.getItem('theme') || 'auto';

    if (Theme === 'auto') {
        let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) document.body.setAttribute('theme', 'dark');
    } else if (Theme === "normal") { 
        document.body.removeAttribute('theme'); 
    }
    else { 
        document.body.setAttribute('theme', Theme); 
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (Theme === 'auto') {
            let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (isDarkMode) document.body.setAttribute('theme','dark');
            else document.body.removeAttribute('theme');
        }
    });
}