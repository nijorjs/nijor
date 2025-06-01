import postcss from "postcss";
import cssParser from "postcss-selector-parser";

export function treeshake(css, classes) {
    const validClasses = new Set();
    const pseudoClasses = new Map();
    const usedSelectors = new Set();
    const keyframesToKeep = new Set();
    let resultCss = "";
    let mediaCss = "";

    classes.forEach(cls => {
        const match = cls.match(/(.*?):(.*)/);
        if (match) {
            const pseudo = match[1];
            const baseClass = match[2];
            if (!pseudoClasses.has(baseClass)) {
                pseudoClasses.set(baseClass, new Set());
            }
            pseudoClasses.get(baseClass).add(`._${pseudo}-${baseClass}:${pseudo}`);
        } else {
            validClasses.add(`.${cls}`);
        }
    });

    const root = postcss.parse(css);
    const extractedRules = new Map();

    function processRule(rule) {
        let keepRule = false;
        let className = "";

        const selectorParser = cssParser(selectors => {
            selectors.walkClasses(classNode => {
                const classSelector = `.${classNode.value}`;
                if (validClasses.has(classSelector) || pseudoClasses.has(classNode.value)) {
                    keepRule = true;
                    usedSelectors.add(rule.selector);
                    className = classNode.value;
                }
            });
        });

        selectorParser.processSync(rule.selector);

        if (keepRule) {
            extractedRules.set(className, rule.nodes.map(node => node.toString()).join(" "));
            return validClasses.has(`.${className}`) ? rule.toString() + "\n" : "";
        }
        return "";
    }

    root.walkRules(rule => {
        if (!rule.parent || rule.parent.type !== "atrule" || rule.parent.name !== "media") {
            const processedRule = processRule(rule);
            if (processedRule) {
                resultCss += processedRule;
                rule.walkDecls(decl => {
                    if (decl.prop.includes("animation")) {
                        const animationNames = decl.value.split(/\s+/).filter(name => !/\d/.test(name));
                        animationNames.forEach(name => keyframesToKeep.add(name));
                    }
                });
            }
        }
    });

    root.walkAtRules("media", atRule => {
        let localMediaCss = "";
        atRule.walkRules(rule => {
            const processedRule = processRule(rule);
            if (processedRule) {
                localMediaCss += processedRule;
                rule.walkDecls(decl => {
                    if (decl.prop.includes("animation")) {
                        const animationNames = decl.value.split(/\s+/).filter(name => !/\d/.test(name));
                        animationNames.forEach(name => keyframesToKeep.add(name));
                    }
                });
            }
        });
        
        if (localMediaCss) {
            mediaCss += `@media ${atRule.params} {\n${localMediaCss}}\n`;
        }
    });

    let keyframeCss = "";
    root.walkAtRules("keyframes", atRule => {
        if (keyframesToKeep.has(atRule.params)) {
            keyframeCss += atRule.toString() + "\n";
        }
    });

    let pseudoCss = "";
    pseudoClasses.forEach((pseudoSet, baseClass) => {
        if (extractedRules.has(baseClass)) {
            pseudoSet.forEach(pseudoSelector => {
                pseudoCss += `${pseudoSelector} { ${extractedRules.get(baseClass)} }\n`;
            });
        }
    });

    return resultCss + mediaCss + keyframeCss + pseudoCss;
}