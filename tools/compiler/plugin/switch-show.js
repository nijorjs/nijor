import GenerateId from '../../../utils/uniqeid.js';
import { runComponents } from './sandbox.js';

export default function (document, presecript, scope, specs) {
    let fncCode = ``;
    let $total_components = 0;

    document.querySelectorAll('[n:switch]').forEach(element => {
        const id = element.id || GenerateId(3, 5) + scope;
        element.setAttribute('id', id);
        const $var = element.getAttribute('n:switch');
        const $cvar = `$_${$var.replace('@', '')}_${scope}`;
        element.removeAttribute('n:switch');
        element.setAttribute('tmp','');

        // console.log(element.innerHTML)

        const fncName = 'f' + id;

        [...element.getElementsByTagName('n:show')].forEach((block,index) => {
            let condition = block.getAttribute('when').replace($var, $cvar + '.value');
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
        }`;

        presecript += fncCode;
        presecript += `${$cvar}.subscribe(${$async}()=> ${$await} ${fncName}());`;

    });

    return [document.innerHTML, presecript];
}