import {appendFile} from 'fs/promises';
import { minifyCSS } from "../../../utils/minify.js";
import postcss from "postcss";
import nested from "postcss-nested";
import nestedProps from "postcss-nested-props";
import compressVariables from "postcss-variable-compress";
import combineDuplicated from "postcss-combine-duplicated-selectors";
import autoprefixer from "autoprefixer";

function AddScope(scope) {
    return {
        postcssPlugin: 'n-scope',
        Rule(rule) {
            // Skip keyframes
            if (rule.parent && rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') {
                return;
            }

            rule.selectors = rule.selectors.map(selector => {
                return selector.split(',').map(part => {
                    part = part.trim();
                    const parts = part.split(/(\s+|>\s*|\+\s*|~\s*)/);
                    return parts.map(sub => {
          
                        if (sub.indexOf("::") > -1) {
                            let x = sub.split('::');
                            x[0] += `[n-scope="${scope}"]`;
                            return x.join('::');
                        }

                        if (sub.indexOf(":") > -1) {
                            let x = sub.split(':');
                            x[0] += `[n-scope="${scope}"]`;
                            return x.join(':');
                        }

                        if (/^[a-zA-Z0-9._#:[]/.test(sub)) {
                            return `${sub}[n-scope="${scope}"]`;
                        }

                        return sub;
                    }).join('');
                }).join(', ');
            });
        }
    };
}

export async function ModifyCSS(css,scope){
    let plugins = [nested(), nestedProps(), compressVariables(), combineDuplicated(), autoprefixer()];
    if(scope) plugins.push(AddScope(scope))
    let { css: modifiedCSS } = await postcss(plugins).process(css, { from: 'test', to: 'test' });
    return minifyCSS(modifiedCSS);
}

export async function WriteStyleSheet(doc,scope,options){

    doc.window.document.querySelectorAll('n-style').forEach(async styleTag=>{
        let theme = styleTag.getAttribute('theme');
        let CSS = await ModifyCSS(styleTag.innerHTML,scope);
        if(theme==="normal"){
            await appendFile(options.styleSheet,CSS);
        }else{
            await appendFile(options.styleSheet,await ModifyCSS(`body[theme="${theme}"]{${CSS}}`));
        }
    });
}