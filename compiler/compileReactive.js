import { parse } from 'acorn';
import MagicString from 'magic-string';

export function compileReactive(code) {
    const s = new MagicString(code);
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

    function findDependencies(node, deps = new Set()) {
        if (!node) return deps;
        if (
            node.type === 'MemberExpression' &&
            node.object.name === '$' &&
            node.property.type === 'Identifier'
        ) {
            deps.add(node.property.name);
        }

        for (const key in node) {
            const child = node[key];
            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    child.forEach(c => findDependencies(c, deps));
                } else {
                    findDependencies(child, deps);
                }
            }
        }
        return deps;
    }

    ast.body.forEach(node => {
        if (node.type === 'LabeledStatement' && node.label.name === '_') {
            const statement = node.body;

            // 1. Remove the "_ :" label
            // We remove from the start of the label to the start of the actual statement
            s.remove(node.start, statement.start);

            if (statement.type === 'ExpressionStatement' && statement.expression.type === 'AssignmentExpression') {
                const assignment = statement.expression;
                const dependencies = findDependencies(assignment.right);

                // Use the original assignment code for the callback
                const actionCode = code.slice(assignment.start, assignment.end);

                let injections = '';
                dependencies.forEach(dep => {
                    injections += `\n$.$subscribe('${dep}', () => ${actionCode} );`;
                });

                s.appendRight(node.end, injections);
            }
        }
    });

    return s.toString();
}