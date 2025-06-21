import GenerateId from '../../../utils/uniqeid.js';
import { minifyHTML } from '../../../utils/minify.js';
import { transpile } from './transpile.js';

function hasReactiveVariables(JScode) {
  let i = 0;
  let inString = false;
  let stringQuote = null;
  let inTemplate = false;

  while (i < JScode.length) {
    const char = JScode[i];
    const nextChar = JScode[i + 1];

    // Handle string literals
    if (!inString && !inTemplate && (char === '"' || char === "'" || char === '`')) {
      inString = char !== '`';
      inTemplate = char === '`';
      stringQuote = char;
      i++;
      continue;
    }

    if (inString && char === stringQuote && JScode[i - 1] !== '\\') {
      inString = false;
      i++;
      continue;
    }

    if (inTemplate && char === stringQuote && JScode[i - 1] !== '\\') {
      inTemplate = false;
      i++;
      continue;
    }

    if (inTemplate && char === '$' && nextChar === '{') {
      i += 2;
      continue;
    }

    // Skip content inside strings and templates
    if (inString || inTemplate) {
      i++;
      continue;
    }

    // Check for @varname in expressions
    if (
      char === '@' &&
      nextChar && /\w/.test(nextChar) &&
      (i === 0 || !/\w/.test(JScode[i - 1]))
    ) {
      // Ensure it's followed by a word character to form @varname
      if (JScode.slice(i).match(/^@\w+/)) {
        return true;
      }
    }

    i++;
  }

  return false;
}

function convertTemplateSyntax(str) {
  return str.replace(/(?<!\\)\$\{@(\w+)\}/g, '{@$1}').replace(/\\\$\{@(\w+)\}/g, '${@$1}'); // Restore escaped ones
}

export default function (document, prescript, deferscript, scope) {

    if(!hasReactiveVariables(prescript)) {
        return { transformedHTML : document.innerHTML, prescript, deferscript };
    }

    let subscribeCode = ``;

    const reactive = `_$reactive_${scope}`;
    prescript = `import {reactive as ${reactive}, replaceTemplate as $Temp${scope}} from "nijor/reactivity";` + prescript;

    const elements = Array.from(document.querySelectorAll('*')).filter(element => Array.from(element.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join('').match(/(?<!\\)\${@[^}]+}/));
    const InputRefElements = document.querySelectorAll('input[n:ref]');

    elements.forEach(element => {

        if(element.tagName.toLowerCase()==="n:show"){
            let $var = element.innerHTML.match(/(?<!\\){@([^}]+)}/)[1];
            element.innerHTML = element.innerHTML.replace(`@${$var}`,`$_${$var}_${scope}.value`);
            return;
        }

        const id = element.getAttribute('id') || GenerateId(3,5)+'_'+scope;
        element.setAttribute('id',id);

        const variables = Array.from(element.innerHTML.matchAll(/(?<!\\){@([^}]+)}/g), match => match[1]);
        let mapVarValue = new Set();
        let subscribersSet = new Set();
        
        for (let i of variables) {
            mapVarValue.add(`"${i}":$_${i}_${scope}.value`);
            subscribersSet.add(i);
        }

        const subscribers = [... subscribersSet]; // Convert Set to Array
        
        const templateStr = minifyHTML(element.innerHTML);
        element.innerHTML = "";

        const dict = '{' + [...mapVarValue].join(',') + '}';

        if(subscribers.length=== 1){

            subscribeCode+=`
            $_${subscribers[0]}_${scope}.subscribe(()=>{
                document.getElementById('${id}').innerHTML = $Temp${scope}(\`${convertTemplateSyntax(templateStr)}\`,${dict});
            });`;

        }else{
            let fncName = 'f' + GenerateId(3,5);
            subscribeCode+= `
                function ${fncName}(){
                    document.getElementById('${id}').innerHTML = $Temp${scope}(\`${convertTemplateSyntax(templateStr)}\`,${dict});
                }
            `;
            subscribers.forEach(sub=>{
                subscribeCode+=`
                $_${sub}_${scope}.subscribe(${fncName});`;
            });
        }

    });

    InputRefElements.forEach(element => {
        const refVar = element.getAttribute('n:ref').replace('@', '');
        const eventName = `${refVar}@${scope}`;
        element.removeAttribute('n:ref');

        prescript += `
        window.eventStorage['${eventName}'] = function (_this){
            $_${refVar}_${scope}.value = _this.value;
        }`;

        element.setAttribute('oninput', `window.eventStorage['${eventName}'](this)`);
    });

    let { code , deferInit} = transpile(prescript, scope, reactive,process.seed);
    prescript = code + subscribeCode;
    deferscript = transpile(deferscript, scope, reactive,process.seed).code + deferInit;

    return { transformedHTML : document.innerHTML, prescript, deferscript };
}