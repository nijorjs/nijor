import createFilter from './createFilter.js';
import { JSDOM } from 'jsdom';
import GenerateID from '../../../utils/uniqeid.js';
import { replaceTags } from '../../../utils/replaceTags.js';
import TemplateLoader from './template.js';
import * as Scripts from './handleScripts.js' ;

export default options => {
    let opts = { include: '**/*.nijor' };
    const filter = createFilter(opts.include, opts.exclude);
    return {

        name: "compiler",
        async transform(code, filename) {
            let componentName = filename.replace('/', '\\').split('\\').reverse();

            if (filter(filename)) {
                let newCode = replaceTags(code,'style','n-style');
                newCode = replaceTags(newCode,'body','template');

                const VirtualDocument = new JSDOM(newCode);
                const document = VirtualDocument.window.document;
                const props = document.querySelector('template').getAttribute('props') || document.querySelector('template').getAttribute('params') || '';

                try {
                    document.querySelectorAll('script').forEach(child => {
                        if (child.hasAttribute('defer')) child.setAttribute('execute', 'post');
                        if (child.hasAttribute('mid')) child.setAttribute('execute', 'mid');
                        if (child.getAttribute('execute') === "post" || child.getAttribute('execute') === "mid") return;
                        child.setAttribute('execute', 'pre');
                    });
                } catch (error) { }

                // Handle Different Color Modes ::Start
                try {
                    document.querySelectorAll('n-style').forEach(child => {
                        if (!(child.hasAttribute('theme'))) child.setAttribute('theme', 'normal');
                    });
                } catch (error) { }
                // Handle Different Color Modes ::End

                const scope = GenerateID(4, 6).toLowerCase();
                const importStatements = Scripts.ReturnScripts(VirtualDocument,'pre',scope,process.seed).ImportStatements;
                const midScript = Scripts.ReturnScripts(VirtualDocument,'mid').script;
                const ImportComponents = Scripts.ReturnModule(VirtualDocument,scope);
                const { template, JScode, DeferScripts } = await TemplateLoader(VirtualDocument,scope,options,props,filename);
                return {
                    code: `
                    import component_${process.seed} from 'nijor/component';
                    ${ImportComponents}
                    ${importStatements}
                    ${JScode}
                    export default new component_${process.seed}(async function(${props}){
                        ${midScript}
                        return(\`${template}\`);
                    },async function(${props}){
                        ${DeferScripts}
                    });
                    `,
                    map: { mappings: "" }
                };

            }

        }

    };
}