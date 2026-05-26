import * as acorn from "acorn";
import * as walk from "acorn-walk";

export function sanitize(doc) {
    const scriptElement = doc.window.document.querySelector('script');
    if (!scriptElement) return [[], '', '', null, null];
    let script = scriptElement.innerHTML;

    const ast = acorn.parse(script, { ecmaVersion: "latest", sourceType: "module" });

    const imports = [];
    const globals = [];
    let onMount = null;
    let onUnmount = null;
    const usedRanges = [];
    const getCode = (node) => script.slice(node.start, node.end);
    const markUsed = (node) => usedRanges.push([node.start, node.end]);

    walk.simple(ast, {
        ImportDeclaration(node) {
            imports.push(getCode(node));
            markUsed(node);
        },

        ExportNamedDeclaration(node) {
            const decl = node.declaration;
            if (!decl) return;

            // ---- Handle function declarations ----
            if (decl.type === "FunctionDeclaration") {
                const name = decl.id.name;

                if (name === "onMount" || name === "onUnmount") {
                    const body = script.slice(decl.body.start + 1, decl.body.end - 1).trim();

                    if (name === "onMount") onMount = body;
                    else onUnmount = body;

                    markUsed(node);
                    return;
                }

                // other exported functions → global
                globals.push(getCode(decl));
                markUsed(node);
            }

            // ---- Handle variable declarations ----
            else if (decl.type === "VariableDeclaration") {
                for (const d of decl.declarations) {
                    const id = d.id.name;

                    // detect arrow function exports
                    if (
                        (id === "onMount" || id === "onUnmount") &&
                        d.init &&
                        (d.init.type === "ArrowFunctionExpression" ||
                            d.init.type === "FunctionExpression")
                    ) {
                        const bodyNode = d.init.body;

                        let body;
                        if (bodyNode.type === "BlockStatement") {
                            body = script.slice(bodyNode.start + 1, bodyNode.end - 1).trim();
                        } else {
                            // implicit return: () => expr
                            body = `return ${getCode(bodyNode)};`;
                        }

                        if (id === "onMount") onMount = body;
                        else onUnmount = body;

                        markUsed(node);
                        return;
                    }
                }

                // other exports → global
                globals.push(getCode(decl));
                markUsed(node);
            }

            // ---- Handle class exports ----
            else if (decl.type === "ClassDeclaration") {
                globals.push(getCode(decl));
                markUsed(node);
            }
        }
    });

    // ---- Remove used ranges to get remaining script ----
    let remaining = "";
    let lastIndex = 0;

    usedRanges.sort((a, b) => a[0] - b[0]);

    for (const [start, end] of usedRanges) {
        remaining += script.slice(lastIndex, start);
        lastIndex = end;
    }

    remaining += script.slice(lastIndex);

    return [
        imports,
        remaining.trim(),
        globals.join("\n\n").trim(),
        onMount,
        onUnmount
    ];
}

export function ReturnModule(doc, scope) {
    /* convert the component imports to javascript imports
    Ex:- <import name="header" source="@/components/header.nijor"/> will convert to 
          import $header_scope from "@/components/header.nijor";
    */
    let Mod = [];

    doc.window.document.querySelectorAll('import').forEach(component => {
        if (component.closest('nijor-body')) return;
        let name = `$${component.getAttribute('name').toLowerCase().replaceAll('-', '')}`;
        let source = component.getAttribute('source');
        Mod.push(`import ${name}_${scope} from "${source}";`)
    });

    return Mod.join('');
}