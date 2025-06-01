import createFilter from './createFilter.js';
import { JSDOM } from 'jsdom';
import GenerateID from '../../../utils/uniqeid.js';
import TemplateLoader from './template.js';
import * as Scripts from './handleScripts.js' ;

export default options => {
    let opts = { include: '**/*.nijor' };
    const filter = createFilter(opts.include, opts.exclude);
    let { rootdir } = options;
    return {

        name: "compiler",
        async transform(code, id) {
            let componentName = id.replace('/', '\\').split('\\').reverse();

            // Msg Compiler : Compiling component

            if (filter(id)) {
                let newCode = code.replace(new RegExp('<style', 'g'), '<n-style');
                newCode = newCode.replace(new RegExp('</style', 'g'), '</n-style');
                newCode = newCode.replace(new RegExp('<body', 'g'), '<template');
                newCode = newCode.replace(new RegExp('</body', 'g'), '</template');

                const VirtualDocument = new JSDOM(newCode);
                const specsAttr = VirtualDocument.window.document.querySelector('template').getAttribute('specs') || '';

                try {
                    VirtualDocument.window.document.querySelectorAll('script').forEach(child => {
                        if (child.hasAttribute('defer')) child.setAttribute('execute', 'post');
                        if (child.hasAttribute('mid')) child.setAttribute('execute', 'mid');
                        if (child.getAttribute('execute') === "post" || child.getAttribute('execute') === "mid") return;
                        child.setAttribute('execute', 'pre');
                    });
                } catch (error) { }

                // Handle Different Color Modes ::Start
                try {
                    VirtualDocument.window.document.querySelectorAll('n-style').forEach(child => {
                        if (!(child.hasAttribute('mode'))) child.setAttribute('mode', 'normal');
                    });
                } catch (error) { }
                // Handle Different Color Modes ::End

                const scope = GenerateID(4, 6).toLowerCase();
                const {template,JScode,DeferScripts} = await TemplateLoader(VirtualDocument,scope,options,specsAttr,id);
                const importStatements =  Scripts.ReturnScripts(VirtualDocument,'pre').ImportStatements;
                const midScript = Scripts.ReturnScripts(VirtualDocument,'mid').script;
                const ImportComponents = Scripts.ReturnModule(VirtualDocument);
                
                return {
                    code: `
                    ${ImportComponents}
                    ${importStatements}
                    ${JScode}
                      export default new window.nijor.component(async function(${specsAttr}){
                            ${midScript}
                            return(\`${template}\`);
                      },async function(${specsAttr}){
                            ${DeferScripts}
                    });
                    `,
                    map: { mappings: "" }
                };

            }

        }

    };
}