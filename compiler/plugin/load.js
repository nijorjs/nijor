import { minifyHTML } from '../../utils/minify.js';
import { runComponents } from './sandbox.js';

export function nload({document, scope, scripts}) {

    document.querySelectorAll("[n:load]").forEach((element, index) => {
        let [variable,loader] = element.getAttribute('n:load').split(':');
        variable = variable.trim();
        element.removeAttribute('n:load');
        const functionID = `load${index + 1}-${scope}`;
        element.id = functionID;

        const $ok = element.getElementsByTagName('n:ok')[0];
        const $loading = element.getElementsByTagName('n:loading')[0];
        const $error = element.getElementsByTagName('n:error')[0];
        const $loop = $ok.getElementsByTagName('n:loop')[0];

        let $ok_run = runComponents($ok, scope);
        let $error_run = runComponents($error, scope);
        let $loading_run = runComponents($loading, scope);

        element.innerHTML = $loading.innerHTML;

        let vars_inside_template = ``;
        getAttributesFromProps(extractTemplateWords($ok.innerHTML, [variable])).forEach(attr => {
            if(attr==="") return;
            element.setAttribute(`data-attr-${attr}`, "${" + attr + "}");
            vars_inside_template += `let ${attr} = div${scope}.getAttribute("data-attr-${attr}") || "{${attr}}";`;
        });

        if(!$ok.hasAttribute('loop') && !$loop)
        scripts.global += `
            window.eventStorage['${functionID}'] = async function(){
                const range_${scope} = document.createRange();
                const div${scope} = document.getElementById('${functionID}');
                ${vars_inside_template}
                let template_${scope} = "";
                try{
                    let ${variable} = await ${loader};
                    template_${scope} = \`${minifyHTML($ok.innerHTML)}\`;
                    const fragment_${scope} = range_${scope}.createContextualFragment(template_${scope});
                    div${scope}.replaceChildren(fragment_${scope});
                    ${$ok_run}
                }catch(err){
                    template_${scope} = \`${minifyHTML($error.innerHTML)}\`;
                    const fragment_${scope} = range_${scope}.createContextualFragment(template_${scope});
                    div${scope}.replaceChildren(fragment_${scope});
                    ${$error_run}
                }
            }
        `;

        if($ok.hasAttribute('loop'))
        scripts.global += `
            window.eventStorage['${functionID}'] = async function (){
                const range_${scope} = document.createRange();
                const div${scope} = document.getElementById('${functionID}');
                ${vars_inside_template}
                try{
                    let template_${scope}="";
                    let count${scope} = 0;
                    for(let ${variable} of await ${loader}){
                        template_${scope} += \`${minifyHTML($ok.innerHTML)}\`;
                        count${scope}++;
                    }
                    const fragment_${scope} = range_${scope}.createContextualFragment(template_${scope});
                    div${scope}.replaceChildren(fragment_${scope});
                    ${runComponents($ok, scope)}
                }catch(err){
                    const fragment_${scope} = range_${scope}.createContextualFragment(\`${minifyHTML($error.innerHTML)}\`);
                    div${scope}.replaceChildren(fragment_${scope});
                    ${$error_run}
                }
            }
        `;

        if($loop){
            const loopID = `${functionID}-loop`;
            const { parentElement } = $loop;
            parentElement.replaceChild(document.createComment(loopID),$loop);

            scripts.global += `
                window.eventStorage['${functionID}'] = async function (){
                    const range_${scope} = document.createRange();
                    const div${scope} = document.getElementById('${functionID}');
                    ${vars_inside_template}
                    try{
                        let template_${scope}="";
                        let count${scope} = 0;
                        for(let ${variable} of await ${loader}){
                            template_${scope} += \`${minifyHTML($loop.innerHTML)}\`;
                            count${scope}++;
                        }
                        template_${scope} = \`${minifyHTML($ok.innerHTML)}\`.replace('<!--${loopID}-->',template_${scope});
                        const fragment_${scope} = range_${scope}.createContextualFragment(template_${scope});
                        div${scope}.replaceChildren(fragment_${scope});
                        ${runComponents($ok, scope)}
                    }catch(err){
                        const fragment_${scope} = range_${scope}.createContextualFragment(\`${minifyHTML($error.innerHTML)}\`);
                        div${scope}.replaceChildren(fragment_${scope});
                        ${$error_run}
                    }
                }
            `;
        }

        scripts.defer += `
        // @ommit:start
        await window.eventStorage['${functionID}']();
        // @ommit:end
        `;

        if (element.hasAttribute('n:reload')) {
            const reload = element.getAttribute('n:reload');
            element.removeAttribute('n:reload');
            element.setAttribute('reload-id', reload);
            element.setAttribute('reload-fnx', functionID+'-reload');

            let vars_inside_template = ``;
            getAttributesFromProps(extractTemplateWords($loading.innerHTML, [variable])).forEach(attr => {
                if(attr==="") return;
                element.setAttribute(`data-attr-${attr}`, "${" + attr + "}");
                vars_inside_template += `let ${attr} = div${scope}.getAttribute("data-attr-${attr}") || "{${attr}}";`;
            });

            scripts.global += `window.eventStorage['${functionID}-reload'] = async function() {
                const div${scope} = document.getElementById('${functionID}');
                ${vars_inside_template}
                div${scope}.innerHTML=\`${minifyHTML($loading.innerHTML)}\`;
                ${$loading_run}
                await window.eventStorage['${functionID}']();
            };`;
        }

    });

    return ({
        body: document.body.innerHTML,
        ...scripts
    });
}

function getAttributesFromProps(props) {
    // Remove curly braces or square brackets and split by comma
    return props.replace(/^[{\[]|[}\]]$/g, '').split(',');
}

function extractTemplateWords(str, omit = []) {
    const regex = /\${([^}\[.]*?)(?:\[.*?\]|\.[^}]*)?}/g;
    let matches = new Set();
    let match;

    while ((match = regex.exec(str)) !== null) {
        if (!omit.includes(match[1])) {
            matches.add(match[1]);
        }
    }

    return `{${[...matches].join(", ")}}`;
}