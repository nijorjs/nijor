import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import postcss from 'postcss';
import nested from 'postcss-nested';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';

let collectedCSS = '';

export function reset() {
    collectedCSS = '';
}

async function loadPostCSSConfig(configPath) {
    if (!existsSync(configPath)) return { plugins: [] };

    try {
        const config = await import(configPath);
        const { plugins = {} } = config.default ?? config;

        if (Array.isArray(plugins)) return { plugins };
        const require = createRequire(configPath);
        const resolved = Object.entries(plugins).map(([name, opts]) => {
            const plugin = require(name);
            return plugin(opts);
        });

        return { plugins: resolved };
    } catch (e) {
        console.warn(`[nijor] postcss.config.mjs error : ${e.message}`);
        return { plugins: [] };
    }
}

export async function write(stylesheetPath, RootPath, dev) {
    const configPath = path.join(RootPath, 'postcss.config.mjs');
    const userConfig = await loadPostCSSConfig(configPath);

    const plugins = [
        nested(),
        autoprefixer(),
        ...userConfig.plugins,
        ...(dev ? [] : [cssnano({ preset: 'default' })]) // Only minify in production mode
    ].filter(Boolean);

    const { css } = await postcss(plugins).process(collectedCSS, { from: undefined });

    await writeFile(stylesheetPath, css);
    collectedCSS = '';
}

function AddScopePlugin(scope) {
    return {
        postcssPlugin: 'n-scope',
        Rule(rule) {
            if (
                rule.parent &&
                rule.parent.type === 'atrule' &&
                rule.parent.name === 'keyframes'
            ) return;

            rule.selectors = rule.selectors.map(selector => {
                return selector.split(',').map(part => {
                    part = part.trim();

                    const parts = part.split(/(\s+|>\s*|\+\s*|~\s*)/);

                    return parts.map(sub => {

                        if (sub.includes("::")) {
                            let x = sub.split('::');
                            x[0] += `[n-scope="${scope}"]`;
                            return x.join('::');
                        }

                        if (sub.includes(":")) {
                            let x = sub.split(':');
                            if (!x[0].includes(`[n-scope="${scope}"]`)) {
                                x[0] += `[n-scope="${scope}"]`;
                            }
                            return x.join(':');
                        }

                        if (/^[a-zA-Z0-9._#\[]/.test(sub)) {
                            if (sub.includes(`[n-scope="${scope}"]`)) {
                                return sub;
                            }
                            return `${sub}[n-scope="${scope}"]`;
                        }

                        return sub;
                    }).join('');
                }).join(', ');
            });
        }
    };
}

async function addScope(css_string, scope) {
    const { css } = await postcss([AddScopePlugin(scope)]).process(css_string, { from: undefined });
    return css;
}

export async function WriteStyleSheet(document, scope) {
    for (const styleTag of document.querySelectorAll('nijor-style')) {
        const theme = styleTag.getAttribute('theme') || "normal";
        const css = await addScope(styleTag.innerHTML, scope);

        if (theme === "normal") {
            collectedCSS += css;
        } else {
            collectedCSS += `body[theme="${theme}"]{${css}}`;
        }
    }
}

export function global(css) {
    collectedCSS = css + collectedCSS;
}