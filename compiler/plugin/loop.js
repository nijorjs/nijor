import { minifyHTML } from '../../utils/minify.js';
import uniqeid from '../../utils/uniqeid.js';
import { runComponents, getAllComponents } from './sandbox.js';

export function loop({ document, scope, scripts, module_type }) {

    scripts.import.add(`import {getNodesByCommentID as $comment_${scope}} from 'nijor/reactivity';`);

    document.querySelectorAll("[n:loop]").forEach((element, index) => {
        const raw_source = element.getAttribute('source');
        const source = raw_source.replace('@','');
        const variable = element.getAttribute('var');
        element.removeAttribute('source');
        element.removeAttribute('var');
        if (!variable || !source) return;

        const loopID = element.id || `l\${$id}${index}${scope}`;
        if(!element.id) element.id = loopID;

        getAllComponents(element,scope).forEach((e,i)=>{
            e.setAttribute('_id', `${e.getAttribute('_id')}\${index${scope}}`);
        });

        element.querySelectorAll('[n\\:rclasses]').forEach(el=>{
            const classes = el.getAttribute('n:rclasses').split(' ');
            el.removeAttribute('n:rclasses');
            
            classes.forEach(classname=>{
                const dependents = el.getAttribute(`n:rclass:${classname}`).split(' ');
                const condition = el.getAttribute(`n:rclass:${classname}:condition`);
                el.removeAttribute(`n:rclass:${classname}`);
                el.removeAttribute(`n:rclass:${classname}:condition`);

                dependents.forEach(rvar=>{
                    const identifier = `\${$id}${rvar}${uniqeid(3,4)}`;
                    el.classList.add(identifier);
                    scripts.main += `
                        $.$subscribe('${rvar}',()=>{
                            [...document.getElementsByClassName(\`${identifier}\`)]?.forEach((e${scope},i${scope})=>{
                                const ${variable} = ${source}[i${scope}];
                                if(${condition}) e${scope}?.classList.add('${classname}');
                                else e${scope}?.classList.remove('${classname}');
                            });
                        });
                    `;
                });
            });
        });

        const template = minifyHTML(element.innerHTML);

        const code = `\${${source}.map(function(${variable},index${scope}){return \`${template}\`;}).join("")}`;
        element.innerHTML = code;
        const $run_components = runComponents(element, scope);

        if (raw_source.startsWith('$.')){ 

            const reload_code = `
            const Block_${scope} = document.getElementById(\`${loopID}\`);
            if(!Block_${scope}) return;
            const fragment_${scope} = document.createRange().createContextualFragment(\`${code}\`);
            Block_${scope}.replaceChildren(fragment_${scope});
            ${$run_components}
            `;

            scripts.main += `$.$subscribe('${source.replace('$.','')}',()=>{${reload_code}});`;
        }

        if(raw_source.startsWith('@')){

            const code = `\${${source}.map(function(${variable},index${scope}){return \`<!--\${${variable}._id}-->${template}<!--/\${${variable}._id}-->\`;}).join("")}`;
            element.innerHTML = code;

            const $var = raw_source.replace('@','');

            scripts.global += `
                ${$var}.subscribe(async c${scope}=>{
                    const Block_${scope} = document?.getElementById("${loopID}");
                    if(!Block_${scope}) return;
                    // \${getAttributes_reload};

                    if(c${scope}.operation == "insert"){
                        c${scope}.elements.forEach(x${scope}=>{
                            const ${variable} = x${scope};
                            const index${scope} = ${$var}.value.length;
                            const fragment${scope} = document.createRange().createContextualFragment(\`<!--\${${variable}._id}-->${template}<!--/\${${variable}._id}-->\`);
                            Block_${scope}.appendChild(fragment${scope});
                        });
                        ${$run_components}
                    }
                    
                    if(c${scope}.operation == "delete"){
                        c${scope}.elements.forEach(x${scope}=>{
                            const nodes_${scope} = $comment_${scope}(x${scope},Block_${scope});
                            if (nodes_${scope} && nodes_${scope}.length > 0) {
                                const range_${scope} = document.createRange();
                                range_${scope}.setStartBefore(nodes_${scope}[0]);
                                range_${scope}.setEndAfter(nodes_${scope}[nodes_${scope}.length - 1]);
                                range_${scope}.deleteContents();
                            }
                        });
                    }

                    if(c${scope}.operation == "rewrite"){
                        const fragment${scope} = document.createRange().createContextualFragment(\`${code}\`);
                        Block_${scope}.replaceChildren(fragment${scope});
                        ${$run_components}
                    }
                });
            `;
        }

        scripts.defer += $run_components;

    });

    return ({
        name: "Loop",
        data:{
        body: document.body.innerHTML,
        ...scripts
        }
    });
}