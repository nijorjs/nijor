import { minifyHTML, deepFixInterpolations } from '../../utils/minify.js';
import uniqueid from '../../utils/uniqeid.js';

function getReactiveElements(document) {
  // 1. Find all elements that have ANY attribute starting with "n:attr:"
  // We use a tree walker or querySelectorAll('*') to check attribute names
  const allElements = document.querySelectorAll('*');
  const matches = [];

  allElements.forEach(el => {
    const nAttrs = [];

    // Loop through attributes to find matches
    for (const attr of el.attributes) {
      if (attr.name.startsWith('n:attr:')) {
        // Extract 'abc' from 'n:attr:abc'
        nAttrs.push(attr.name.slice(7));
      }
    }

    if (nAttrs.length > 0) {
      // 2. Attach the custom property 'r_attr' to this specific instance
      Object.defineProperty(el, 'r_attr', {
        get: () => nAttrs,
        configurable: true
      });
      matches.push(el);
    }
  });

  return matches;
}

const isComponent = (tagName, scope) => tagName.endsWith(`_${scope}`);

function handleComponent(reactive_attrs, element, scripts, scope) {
  scripts.import.add(`import {reload as $reload_${scope}} from 'nijor/reactivity';`);
  const _id = element.getAttribute('_id');
  const component = element.tagName.toLowerCase();
  for (const attr of reactive_attrs) {
    let dependents = element.getAttribute(`n:attr:${attr}`).split(" ");
    element.removeAttribute(`n:attr:${attr}`);
    dependents.forEach(rvar => {
      scripts.main += `$.$subscribe('${rvar}',()=> $reload_${scope}('${_id}',$${component},'${component}',\`${element.outerHTML}\`));`;
    });
  }
  element.outerHTML = `<!--${_id}-->${element.outerHTML}<!--/${_id}-->`;
}

const getReactiveClasses = document => [...document.querySelectorAll('*')]
  .filter(el => [...el.attributes].some(attr => attr.name.startsWith('class:')))
  .map(el => {
    const attr = [...el.attributes].find(attr => attr.name.startsWith('class:'));
    el.classname = attr.name.slice('class:'.length);
    return el;
  });

export function reactive({ document, scope, scripts, module_type }) {

  // Handling reactive variables inside tags
  document.querySelectorAll('[n\\:var]').forEach(element => {
    const vars = element.getAttribute('n:var').split(" ");
    const id = element.id || `\${$id}${uniqueid(5, 7)}`;
    const template_str = minifyHTML(element.innerHTML);
    if (!element.id) element.id = id;
    element.removeAttribute('n:var');
    vars.forEach(v => {
      if (element.tagName.toLowerCase() == "textarea")
        scripts.main += ` $.$subscribe('${v}',()=> document.getElementById(\`${id}\`).value = \`${template_str}\`);`;
      else
        scripts.main += ` $.$subscribe('${v}',()=> document.getElementById(\`${id}\`).innerText = \`${template_str}\`);`;
    });

  });

  // Handling reactive variables inside attributes
  getReactiveElements(document).forEach(element => {

    if (isComponent(element.tagName.toLowerCase(), scope)) return handleComponent(element.r_attr, element, scripts, scope);

    const id = element.id || `R\${$id}${uniqueid(5, 7)}`;
    if (!element.id) element.id = id;
    const reactive_attrs = element.r_attr;

    for (const attr of reactive_attrs) {
      let dependents = element.getAttribute(`n:attr:${attr}`).split(" ");
      let value = element.getAttribute(attr);
      element.removeAttribute(`n:attr:${attr}`);

      dependents.forEach(rvar => {
        if (attr.includes(":") || attr.includes(".") || attr.includes("-")) return;
        scripts.main += ` $.$subscribe('${rvar}',()=>document.getElementById(\`${id}\`).${attr} = \`${value}\`);`;
      });
    }
  });

  // Handling reactive classes
  document.querySelectorAll('[n\\:rclasses]').forEach(element=>{
    const classes = element.getAttribute('n:rclasses').split(' ');
    const id = element.id || `R\${$id}${uniqueid(5, 7)}`;
    if(!element.id) element.id = id;
    element.removeAttribute('n:rclasses');

    classes.forEach(classname=>{
      const dependents = element.getAttribute(`n:rclass:${classname}`).split(' ');
      const condition = element.getAttribute(`n:rclass:${classname}:condition`);

      element.removeAttribute(`n:rclass:${classname}`);
      element.removeAttribute(`n:rclass:${classname}:condition`);

      dependents.forEach(rvar=>{

        scripts.main += `
          $.$subscribe('${rvar}',()=>{
            const e${scope} = document.getElementById(\`${id}\`); 
            if(${condition}) e${scope}?.classList.add('${classname}');
            else e${scope}?.classList.remove('${classname}');
          });
        `;
      });

    });

  });

  // Handling bindings on inputs, textarea, contenteditable
  document.querySelectorAll("[n:bind]").forEach((element, index) => {
    const id = element.id || `R\${$id}${uniqueid(5, 7)}`;
    if (!element.id) element.id = id;
    const tagName = element.tagName.toLowerCase();
    if (tagName == "input" || tagName == "textarea" || tagName == "select" || element.getAttribute("contenteditable") == "true") {
      const variable = element.getAttribute("n:bind").trim().slice(3, -1);
      const value = (tagName == "input" || tagName == "textarea" || tagName == "select") ? "value" : "innerText";
      const fnName = `${variable}${index}@${scope}`;
      scripts.main += `window.eventStorage['${fnName}'] = function(){ $.${variable} = document.getElementById(\`${id}\`).${value}; }; `;
      element.setAttribute("oninput", `window.eventStorage['${fnName}']()`);
    }
    element.removeAttribute("n:bind");
  });

  document.querySelectorAll("[n:ref]").forEach(element => {
    const id = element.id || `R\${$id}${uniqueid(5, 7)}`;
    if (!element.id) element.id = id;
    const variable = element.getAttribute("n:ref").trim().slice(3, -1);
    scripts.defer += `$.${variable} = document.getElementById(\`${id}\`); `;
    element.removeAttribute('n:ref');
  });

  return ({
    name: "Reactivity",
    data:{
      body: document.body.innerHTML,
      ...scripts
    }
  });
}