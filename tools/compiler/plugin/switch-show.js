import GenerateId from '../../../utils/uniqeid.js';
import { runComponents } from './sandbox.js';
import { $reference } from './transpile.js';

export default function (document, presecript, scope, props) {
    let fncCode = ``;
    let $total_components = 0;

    document.querySelectorAll('[n:switch]').forEach(element => {
        const id = element.id || GenerateId(3, 5) + scope;
        element.setAttribute('id', id);
        const $var = element.getAttribute('n:switch');
        const $cvar = `$_${$var.replace('@', '')}_${scope}`;
        element.removeAttribute('n:switch');
        element.setAttribute('tmp','');

        const fncName = 'f' + id;

        [...element.getElementsByTagName('n:show')].forEach((block,index) => {
            let condition = $reference(block.getAttribute('when'),scope);
            let content = block.innerHTML;
            let [postHTMLcode, $num_components] = runComponents(block, scope);
            $total_components += $num_components;

            fncCode += `
                if(${condition}){
                    if($tmp==='c${index}') return;
                    $div.setAttribute('tmp','c${index}');
                    $div.innerHTML = \`${content}\`;
                    ${postHTMLcode}
                    return;
                }
            `;
        });

        let defaultCode = '';

        const defaultBlock = element.getElementsByTagName('n:default')[0];
        if(defaultBlock){
            let [postHTMLcode, $components] = runComponents(defaultBlock, scope);
            $total_components += $components.length;

            defaultCode = `

                if($tmp==='d') return;
                $div.setAttribute('tmp','d');
                $div.innerHTML = \`${defaultBlock.innerHTML}\`;
                ${postHTMLcode}
                return;
            `;
        }

        element.innerHTML = "";

        let $async = 'async';
        let $await = 'await';

        if($total_components===0){
            $async = '';
            $await = '';
        }

        fncCode = `${$async} function ${fncName}() { 
        const $div = document.getElementById('${id}');
        const $tmp = $div.getAttribute('tmp');
        ${fncCode}
        ${defaultCode}
        }`;

        presecript += fncCode;
        presecript += `${$cvar}.subscribe(${$async}()=> ${$await} ${fncName}());`;

    });

    return [document.innerHTML, presecript];
}