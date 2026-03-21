import { appendFile } from 'fs/promises';
import cssnano from "cssnano";
import postcss from "postcss";
import nested from "postcss-nested";
import combineDuplicated from "postcss-combine-duplicated-selectors";
import autoprefixer from "autoprefixer";

function AddScope(scope) {
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
                            // Prevent duplicate scope
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

export async function ModifyCSS(css, scope) {
    let plugins = [
        nested(),
        scope ? AddScope(scope) : null,
        combineDuplicated(),
        autoprefixer(),
        cssnano()
    ].filter(Boolean);

    let { css: modifiedCSS } = await postcss(plugins).process(css, {
        from: undefined
    });

    return modifiedCSS;
}

export async function WriteStyleSheet(document, scope, options) {
    for (const styleTag of document.querySelectorAll('nijor-style')) {
        let theme = styleTag.getAttribute('theme') || "normal";

        let CSS = await ModifyCSS(styleTag.innerHTML, scope);

        if (theme === "normal") {
            await appendFile(options.stylesheetPath, CSS);
        } else {
            await appendFile(
                options.stylesheetPath,
                await ModifyCSS(`body[theme="${theme}"]{${CSS}}`)
            );
        }
    }
}