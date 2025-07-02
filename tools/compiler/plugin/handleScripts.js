import { $import } from '../plugin/transpile.js';

export function returnScriptsContent(doc, execute) {
    try {
        return doc.window.document.querySelector('script[execute="' + execute + '"]').innerHTML;
    } catch (error) {
        return '';
    }
}
export function ReturnScripts(doc, execute,scope,seed) {
    try {
        const importStatementRegex = /import[^']+(?= from .*).*/gm;
        let script = returnScriptsContent(doc, execute);
        let ImportStatements;
        try {
            ImportStatements = $import(script.match(importStatementRegex).join('\n'),scope,seed);
        } catch (error) {
            ImportStatements = '';
        }
        try {
            script.match(importStatementRegex).forEach(element => {
                script = script.replace(element, '');
            });
        } catch (error) { }
        return { ImportStatements, script };
    } catch (error) {
        return { ImportStatements: '', script: '' };
    }

}
export function ReturnModule(doc,scope) {
    /* convert the component imports to javascript imports
    Ex:- <header n:imported="components/header"> will convert to 
          import $header_scope from "components/header";
    */
    let Mod = [];
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        let componentVar = '$' + child.tagName.toLowerCase();
        let from = child.getAttribute('n:imported');
        Mod.push(`import ${componentVar}_${scope} from "${from}";`);
    });
    return Mod.join('');
}