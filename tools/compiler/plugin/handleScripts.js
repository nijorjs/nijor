export function returnScriptsContent(doc, execute) {
    try {
        return doc.window.document.querySelector('script[execute="' + execute + '"]').innerHTML;
    } catch (error) {
        return '';
    }
}
export function ReturnScripts(doc, execute) {
    try {
        const importStatementRegex = /import[^']+(?= from .*).*/gm;
        let script = returnScriptsContent(doc, execute);
        let ImportStatements;
        try {
            ImportStatements = script.match(importStatementRegex).join('');
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
export function ReturnModule(doc) {
    /* convert the component imports to javascript imports
    Ex:- <header n:imported="components/header"> will convert to 
          import $header from "components/header";
    */
    let Mod = [];
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        if (child.hasAttribute('lazy')) return;
        let componentVar = '$' + child.tagName.toLowerCase();
        let from = child.getAttribute('n:imported');
        Mod.push(`import ${componentVar} from "${from}";`);
    });
    return Mod.join('');
}
export function ReturnRunModule(doc, ComponentScope) {
    let Mod = [];
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        if (child.hasAttribute('lazy')) return;

        let componentVar = '$' + child.tagName.toLowerCase();
        let OriginalComponentName = child.tagName.toLowerCase();
        let componentName = OriginalComponentName + ComponentScope;
        /* 
        get the ComponentScope
        Change the name of the im
        Call the run function on the imported components.
        $header.init('header'+ComponentScope);
        $header.run();
        */
        Mod.push(`
              ${componentVar}.init('${componentName}');
              await ${componentVar}.run();
            `);
    });
    return Mod.join('');
}
export function ReturnDynamicModule(doc) {
    let Mod = [];
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        if (!(child.hasAttribute('lazy'))) return;
        let componentVar = '$' + child.tagName.toLowerCase();
        let from = child.getAttribute('n:imported');
        Mod.push(`const {default : ${componentVar}} = await import("${from}");`);
    });
    return Mod.join('');
}
export function ReturnDynamicRunModule(doc, ComponentScope) {
    let Mod = [];
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        if (!(child.hasAttribute('lazy'))) return;

        let componentVar = '$' + child.tagName.toLowerCase();
        let OriginalComponentName = child.tagName.toLowerCase();
        let componentName = OriginalComponentName + ComponentScope;
        /* 
        get the ComponentScope
        Change the name of the im
        Call the run function on the imported components.
        $header.init('header'+ComponentScope);
        $header.run();
        */
        Mod.push(`
            ${componentVar}.init('${componentName}');
            await ${componentVar}.run();
          `);
    });
    return Mod.join('');
}