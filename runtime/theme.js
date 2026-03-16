export function setTheme(theme) {
    if (theme === "normal") {
        document.body.removeAttribute("theme");
        window.localStorage.setItem("theme", "normal");
        return;
    }

    if (theme === "auto") {
        window.localStorage.setItem("theme", "auto");
        applyAutoTheme();
        return;
    }

    window.localStorage.setItem("theme", theme);
    document.body.setAttribute("theme", theme);
}

function applyAutoTheme() {
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDarkMode) document.body.setAttribute("theme", "dark");
    else document.body.removeAttribute("theme");
}

export function autoTheme() {
    const theme = window.localStorage.getItem("theme") || "auto";

    if (theme === "auto") {
        applyAutoTheme();
    } else if (theme === "normal") {
        document.body.removeAttribute("theme");
    } else {
        document.body.setAttribute("theme", theme);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    media.addEventListener("change", () => {
        const currentTheme = window.localStorage.getItem("theme") || "auto";
        if (currentTheme === "auto") {
            applyAutoTheme();
        }
    });
}