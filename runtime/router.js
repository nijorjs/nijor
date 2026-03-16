const Routes = new Map();
const Layouts = new Map();

let events = [];

const pageCache = new Map();
const layoutCache = new Map();

function normalizeUrl(url, updateHistory = false) {
    let normalized = url.split('?')[0];

    if (normalized.endsWith('/') && normalized !== "/") {
        normalized = normalized.substring(0, normalized.length - 1);
    }

    if (normalized.endsWith('.html')) {
        normalized = normalized.slice(0, -5);
        if (updateHistory) history.replaceState(null, "", normalized);
    }

    return normalized;
}

function getParams(route, match) {
    const params = {};
    route.params.forEach((name, index) => {
        params[name] = match[index + 1];
    });
    return params;
}

async function loadPage(route, ImportPage) {
    if (!pageCache.has(route)) {
        pageCache.set(route, ImportPage().then(mod => mod.default));
    }
    return await pageCache.get(route);
}

async function loadLayout(name, ImportLayout) {
    if (!layoutCache.has(name)) {
        layoutCache.set(name, ImportLayout().then(mod => mod.default));
    }
    return await layoutCache.get(name);
}

async function renderPage(route, ImportPage, params) {
    const Page = await loadPage(route, ImportPage);
    const layout = Page.layout;

    if (window.nijor.layout == null || window.nijor.layout !== layout) {
        const importLayout = Layouts.get(layout);

        if (!importLayout) {
            throw new Error(`Layout "${layout}" is not registered`);
        }

        const Layout = await loadLayout(layout, importLayout);
        await Layout.render(window.nijor.root);
        window.nijor.layout = layout;
    }

    await Page.render(`layout-${layout}`, params);
}

async function Render404(url) {
    if (url === "/") return false;

    let current = url;

    while (current !== "/") {
        let fragments = current.split('/');

        if (fragments[fragments.length - 1] === "404") {
            fragments.pop();
        }

        fragments.pop();
        fragments.push("404");

        current = fragments.join('/');
        if (current.endsWith('/') && current !== "/") {
            current = current.substring(0, current.length - 1);
        }

        for (const [route, page] of Routes.entries()) {
            const match = current.match(route.pattern);
            if (match) {
                const params = getParams(route, match);
                await page(params);
                return true;
            }
        }

        if (current === "/404") break;
    }

    return false;
}

export async function RenderRoute(url) {
    url = normalizeUrl(url, true);

    for (const [route, page] of Routes.entries()) {
        const match = url.match(route.pattern);
        if (match) {
            const params = getParams(route, match);
            await page(params);
            return true;
        }
    }

    return await Render404(url);
}

window.nijor.setRoute = function (urlData, ImportPage) {
    Routes.set(urlData, async (params) => {
        try {
            await renderPage(urlData, ImportPage, params);
        } catch (e) {
            console.log(e);
        }
    });
};

window.nijor.addLayout = function (name, ImportLayout) {
    Layouts.set(name, ImportLayout);
};

export const onRoute = fn => events.push(fn);

async function runRouteHooks(path) {
    for (const fn of events) {
        try {
            await fn(path);
        } catch (error) {
            console.log(error);
        }
    }
}

async function navigate(path, replace = false) {
    const current = window.location.pathname + window.location.search + window.location.hash;

    if (current !== path) {
        if (replace) history.replaceState({ path }, "", path);
        else history.pushState({ path }, "", path);
    }

    await RenderRoute(path);
    await runRouteHooks(path);
}

window.nijor.redirect = (route) => {
    try {
        const url = new URL(route, window.location.origin);
        const path = url.pathname + url.search + url.hash;
        navigate(path, false);
    } catch (error) {
        window.location.href = route;
    }

    return false;
};

window.addEventListener("popstate", async () => {
    const path = window.location.pathname + window.location.search + window.location.hash;
    await RenderRoute(path);
    await runRouteHooks(path);
});

window.nijor.initialRender = async (route) => {
    await navigate(route, true);
};