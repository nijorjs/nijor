const Routes = [];
const Layouts = new Map();

let events = [];

const pageCache = new Map();
const layoutCache = new Map();
const prefetched = new Set();

/* ---------------- NORMALIZE ---------------- */

function normalizeUrl(url, updateHistory = false) {
    const u = new URL(url, window.location.origin);

    let pathname = u.pathname;

    // Remove trailing slash (except root)
    if (pathname.endsWith('/') && pathname !== "/") {
        pathname = pathname.slice(0, -1);
    }

    // Remove .html
    if (pathname.endsWith('.html')) {
        pathname = pathname.slice(0, -5);
    }

    const full = pathname + u.search + u.hash;

    if (updateHistory) {
        history.replaceState(null, "", full);
    }

    return pathname; // ⚠️ ONLY return pathname for routing
}

/* ---------------- TOKEN MATCHING ---------------- */

function matchSegment(tokens, segment) {
    let i = 0;
    let params = {};

    for (let t = 0; t < tokens.length; t++) {
        const token = tokens[t];

        // 🔹 LITERAL
        if (token.type === "literal") {
            if (!segment.startsWith(token.value, i)) return null;
            i += token.value.length;
        }

        // 🔹 PARAM
        else if (token.type === "param") {
            const remaining = segment.slice(i);

            // 🔑 Find next literal
            let nextLiteral = null;

            for (let j = t + 1; j < tokens.length; j++) {
                if (tokens[j].type === "literal") {
                    nextLiteral = tokens[j].value;
                    break;
                }
            }

            let value;

            if (nextLiteral) {
                const idx = remaining.indexOf(nextLiteral);
                if (idx === -1) return null;

                value = remaining.slice(0, idx);
            } else {
                value = remaining;
            }

            // 🔒 Validate types
            if (token.kind === "int") {
                if (!/^\d+$/.test(value)) return null;
            } else {
                if (value.length === 0) return null;
            }

            params[token.name] = value;
            i += value.length;
        }
    }

    // Must consume entire segment
    if (i !== segment.length) return null;

    return params;
}

function matchRoute(route, pathSegments) {
    if (route.segments.length !== pathSegments.length) return null;

    let params = {};

    for (let i = 0; i < route.segments.length; i++) {
        const res = matchSegment(route.segments[i], pathSegments[i]);
        if (!res) return null;
        Object.assign(params, res);
    }

    return params;
}

/* ---------------- SCORING ---------------- */

function scoreRoute(route) {
    let score = 0;

    for (const segment of route.segments) {
        for (const token of segment) {
            if (token.type === "literal") score += 100;
            else if (token.kind === "int") score += 70;
            else score += 40;
        }
    }

    return score;
}

/* ---------------- PAGE RENDER ---------------- */

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

    const [Layout] = await Promise.all([layoutPromise]);

    if (Layout) {
        await Layout.render(window.nijor.root);
        window.nijor.layout = layoutName;
    }

    await Page.render(`layout-${layoutName}`, params);
}

async function render404(url) {
    let segments = url.split("/").filter(Boolean);

    while (segments.length >= 0) {
        const testSegments = [...segments, "404"];

        for (const route of Routes) {
            const params = matchRoute(route, testSegments);
            if (params) {
                await route.page(params);
                return true;
            }
        }

        if (segments.length === 0) break;
        segments.pop();
    }

    return false;
}

/* ---------------- ROUTE RESOLUTION ---------------- */

export async function RenderRoute(url) {
    url = normalizeUrl(url, true);

    const pathSegments = url.split("/").filter(Boolean);

    let matches = [];

    for (const route of Routes) {
        const params = matchRoute(route, pathSegments);
        if (params) {
            matches.push({
                route,
                params,
                score: scoreRoute(route)
            });
        }
    }

    if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);

        const best = matches[0];
        await best.route.page(best.params);
        return true;
    }

    // 👇 NEW: fallback to 404 chain
    return await render404(url);
}

/* ---------------- ROUTE REGISTRATION ---------------- */

window.nijor.setRoute = function (routeData, importer) {
    const route = {
        ...routeData,
        importer,
        page: async params => {
            try {
                await renderPage(routeData, importer, params);
            } catch (e) {
                console.error(e);
            }
        }
    };

    Routes.push(route);
};

window.nijor.addLayout = function (name, importer) {
    Layouts.set(name, importer);
};

/* ---------------- NAVIGATION ---------------- */

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

/* ---------------- PREFETCH ---------------- */

function getRouteFromPath(path) {
    const segments = path.split("/").filter(Boolean);

    let matches = [];

    for (const route of Routes) {
        const params = matchRoute(route, segments);
        if (params) {
            matches.push({
                route,
                score: scoreRoute(route)
            });
        }
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => b.score - a.score);
    return matches[0];
}

function prefetchPath(path) {
    const url = new URL(path, window.location.origin);
    const match = getRouteFromPath(url.pathname);
    if (!match) return;

    const { route } = match;
    const importer = route.importer; // ✅ FIX

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

/* ---------------- LINK PREFETCH OBSERVER ---------------- */

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