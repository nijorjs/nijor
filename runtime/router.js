const Routes = new Map();
const Layouts = new Map();

let events = [];

const pageCache = new Map();
const layoutCache = new Map();
const prefetched = new Set();

function normalizeUrl(url, updateHistory = false) {
    let normalized = url.split('?')[0];

    if (normalized.endsWith('/') && normalized !== "/") {
        normalized = normalized.slice(0, -1);
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

function loadPage(route, importer) {
    if (!pageCache.has(route)) {
        pageCache.set(route, importer().then(m => m.default));
    }
    return pageCache.get(route);
}

function loadLayout(name, importer) {
    if (!layoutCache.has(name)) {
        layoutCache.set(name, importer().then(m => m.default));
    }
    return layoutCache.get(name);
}

async function renderPage(route, importer, params) {
    const Page = await loadPage(route, importer);
    const layoutName = Page.layout;

    let layoutPromise = null;

    if (window.nijor.layout !== layoutName) {
        const importLayout = Layouts.get(layoutName);
        if (!importLayout) {
            throw new Error(`Layout "${layoutName}" is not registered`);
        }
        layoutPromise = loadLayout(layoutName, importLayout);
    }

    const [Layout] = await Promise.all([
        layoutPromise
    ]);

    if (Layout) {
        await Layout.render(window.nijor.root);
        window.nijor.layout = layoutName;
    }

    await Page.render(`layout-${layoutName}`, params);
}

async function render404(url) {
    if (url === "/") return false;

    let current = url;

    while (current !== "/") {
        let parts = current.split('/');

        if (parts[parts.length - 1] === "404") {
            parts.pop();
        }

        parts.pop();
        parts.push("404");

        current = parts.join('/');

        if (current.endsWith('/') && current !== "/") {
            current = current.slice(0, -1);
        }

        for (const [route, { page }] of Routes.entries()) {
            const match = current.match(route.pattern);
            if (match) {
                await page(getParams(route, match));
                return true;
            }
        }

        if (current === "/404") break;
    }

    return false;
}

export async function RenderRoute(url) {
    url = normalizeUrl(url, true);

    for (const [route, { page }] of Routes.entries()) {
        const match = url.match(route.pattern);
        if (match) {
            await page(getParams(route, match));
            return true;
        }
    }

    return await render404(url);
}

window.nijor.setRoute = function (routeData, importer) {
    const page = async params => {
        try {
            await renderPage(routeData, importer, params);
        } catch (e) {
            console.error(e);
        }
    }
    Routes.set(routeData, { page, importer });
};

window.nijor.addLayout = function (name, importer) {
    Layouts.set(name, importer);
};

export const onRoute = fn => events.push(fn);

async function runRouteHooks(path) {
    await Promise.all(
        events.map(fn => {
            try {
                return fn(path);
            } catch (e) {
                console.error(e);
            }
        })
    );
}

async function navigate(path, replace = false) {
    const current = window.location.pathname + window.location.search + window.location.hash;

    if (current !== path) {
        if (replace) history.replaceState({ path }, "", path);
        else history.pushState({ path }, "", path);
    }

    await Promise.all([
        RenderRoute(path),
        runRouteHooks(path)
    ]);
}

window.nijor.redirect = (route) => {
    try {
        const url = new URL(route, window.location.origin);
        const path = url.pathname + url.search + url.hash;
        navigate(path);
    } catch {
        window.location.href = route;
    }
    return false;
};

window.addEventListener("popstate", async () => {
    const path = window.location.pathname + window.location.search + window.location.hash;
    await Promise.all([
        RenderRoute(path),
        runRouteHooks(path)
    ]);
});

window.nijor.initialRender = async (route) => {
    await navigate(route, true);
};

function getRouteFromPath(path) {
    for (const [route, { importer }] of Routes.entries()) {
        if (route.pattern.test(path)) {
            return { route, importer };
        }
    }
    return null;
}

function prefetchPath(path) {
    const url = new URL(path, window.location.origin);
    path = url.pathname;

    const match = getRouteFromPath(path);
    if (!match) return;

    const { route, importer } = match;

    if (prefetched.has(route)) return;

    prefetched.add(route);

    const pagePromise = loadPage(route, importer);

    pagePromise.then(Page => {
        const layout = Page.layout;
        const layoutImporter = Layouts.get(layout);
        if (layoutImporter) {
            loadLayout(layout, layoutImporter);
        }
    }).catch(() => { });
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));

let observer = null;

if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const link = entry.target;
            const href = link.getAttribute("href");

            if (!href || href.startsWith("http")) return;
            if (link.hasAttribute("no-prefetch")) return;

            const connection = navigator.connection;
            const isSlow = connection && (connection.saveData || connection.effectiveType === "2g" || connection.effectiveType === "slow-2g");

            if (isSlow) return;

            idle(() => prefetchPath(href));

            observer.unobserve(link);
        });
    }, {
        rootMargin: "200px"
    });
}

function scanLinks() {
    if (!observer) return;

    const links = document.querySelectorAll("a[href]");

    links.forEach(link => {
        const href = link.getAttribute("href");

        if (!href || href.startsWith("http")) return;
        if (link.hasAttribute("no-prefetch")) return;

        observer.observe(link);
    });
}

onRoute(() => {
    const idleFn = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    idleFn(scanLinks);
});