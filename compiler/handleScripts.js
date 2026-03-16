export function sanitize(doc) {
    const scriptElement = doc.window.document.querySelector('script');
    
    if (!scriptElement) {
        return [ '', '' ];
    }

    let script = scriptElement.innerHTML;

    const importRegex = /import[^']+(?= from .*).*/gm;
    const matches = script.match(importRegex) || [];

    // Remove import statements
    script = script.replace(importRegex, '').trim();

    return [matches, script];
}

export function ReturnModule(doc,scope) {
    /* convert the component imports to javascript imports
    Ex:- <import name="header" source="@/components/header.nijor"/> will convert to 
          import $header_scope from "@/components/header.nijor";
    */
    let Mod = [];
    
    doc.window.document.querySelectorAll('import').forEach(component=>{
        if(component.closest('nijor-body')) return;
        let name = `$${component.getAttribute('name').toLowerCase().replaceAll('-','')}`;
        let source = component.getAttribute('source');
        Mod.push(`import ${name}_${scope} from "${source}";`)
    });

    return Mod.join('');
}