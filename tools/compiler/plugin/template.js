import { JSDOM } from 'jsdom';
import { WriteStyleSheet } from './style.js';
import { ReturnScripts } from './handleScripts.js';
import CompileOnEventAttribute from './on-event.js';
import Compile_nfor from './n-for.js';
import AsyncLoadData from './async-load.js';
import { minifyHTML } from "../../../utils/minify.js";

function CompileRouteAttribute(VirtualDocument) {
    VirtualDocument.window.document.body.querySelectorAll('a[n:route]').forEach(child => {
        let route = child.getAttribute('n:route');
        child.removeAttribute('n:route');
        child.setAttribute('onclick', `return window.nijor.redirect(this.href)`);
        child.setAttribute('href', route);
    });
    return VirtualDocument.window.document.body.innerHTML;
}

function compileReactiveVariable(input) {
    const matches = [];
    const output = input.replace(/\$\{@(\w+)\}/g, (match, word) => {
        matches.push(word);
        return `<nrv var="${word}" style="all:inhreit;background-color:transparent;">\${window.reactiveVar['${word}']}</nrv>`;
    });
    return { output, matches };
}

function transpileJScode(customJS) {
    // Handle @varname replacement
    return customJS.replace(/@(\w+)\b(?![^\n]*["'])/g, "window.reactiveVar['$1']");
}

let tmpVar;
let allNijorComponents = [];
let allNijorComponentsMap = {};

export default async function (doc, scope, options, specsAttr, filename) {

    await WriteStyleSheet(doc,scope,options); // write the css file

    let template = doc.window.document.querySelector("template").innerHTML;
    template = template.replace(/`/g, '\\`').replace(/{/g, '${').replace(/\\\${/g, '\{');

    let DeferScripts = ReturnScripts(doc,'post').script;
    let JScode = ReturnScripts(doc,'pre').script;
   
    // Changing the name of the components starts here
    doc.window.document.querySelectorAll("[n:imported]").forEach(child => {
        // The ComponentScope's value is added after every imported component.
        // Ex :- <header> -> <headervxxh> depending upon ComponentScope
        let OriginalComponentName = child.tagName.toLowerCase();
        let componentName = `${OriginalComponentName}_${scope}`;
        let cpname = new RegExp('<' + OriginalComponentName, 'gim');
        let cpnameClosing = new RegExp('</' + OriginalComponentName + '>', 'gim');
        template = template.replace(cpname, '<' + componentName);
        template = template.replace(cpnameClosing, '</' + componentName + '>');

        allNijorComponents.push(componentName);
        allNijorComponentsMap[componentName] = OriginalComponentName;
    });
    // Changing the name of the components ends here

    const VirtualDocument = new JSDOM(template);

    // Compiling {@variable} starts here
    let variable  = compileReactiveVariable(VirtualDocument.window.document.body.innerHTML);
    VirtualDocument.window.document.body.innerHTML = variable.output;
    // Compiling {@variable} ends here

    // Compiling n:slot starts here
    VirtualDocument.window.document.body.querySelectorAll('[n:slot]').forEach(child => {

        let route = getRouteFromFilePath(filename);
        child.id = `routes-slot-${route}`;
        child.removeAttribute('n:slot');

    });
    // Compiling n:slot ends here

    // Adding the n-scope attribute starts here
    VirtualDocument.window.document.body.querySelectorAll('*').forEach((child) => {
        if (child.hasAttribute('n-scope') || child.tagName.toLowerCase()==="nrv") return;
        child.setAttribute('n-scope', scope);
    });
    // Adding the n-scope attribute ends here

    // Handling n:style starts here
    VirtualDocument.window.document.body.querySelectorAll('[n:style]').forEach(el=>{
        let classes = el.getAttribute('n:style').replace(/\s+/g, ' ').trim().split(" ");
        el.removeAttribute('n:style');
        classes.forEach(cssClass=>{
            process.cssClasses.add(cssClass);
            el.classList.add(cssClass.replace(/(\w+):(\w+)/, '._$1-$2'));
        })
    });
    // Handling n:style ends here

    // Compiling n:route starts here
    VirtualDocument.window.document.body.innerHTML = CompileRouteAttribute(VirtualDocument);
    // Compiling n:route ends here

    // Compiling n:for starts here
    tmpVar = Compile_nfor(VirtualDocument,JScode,DeferScripts,scope,specsAttr,filename);
    VirtualDocument.window.document.body.innerHTML = tmpVar.template;
    JScode = tmpVar.jsCode;
    DeferScripts = tmpVar.jsCodeDefer;
    // Compiling n:for ends here

    // Compiling n:async starts here
    tmpVar = AsyncLoadData(VirtualDocument,JScode,DeferScripts,scope,specsAttr,filename);
    VirtualDocument.window.document.body.innerHTML = tmpVar.template;
    JScode = tmpVar.jsCode;
    DeferScripts = tmpVar.jsCodeDefer;
    // Compiling n:async ends here

    // Compiling on:{event} starts here
    tmpVar = CompileOnEventAttribute(VirtualDocument,JScode,DeferScripts,scope);
    VirtualDocument.window.document.body.innerHTML = tmpVar.template;
    JScode = tmpVar.jsCode;
    DeferScripts = tmpVar.jsCodeDefer;
    // Compiling on:{event} ends here

    // Running the imported nijor components
    let nijorComponents = [...VirtualDocument.window.document.body.querySelectorAll('*')].filter(el => (new RegExp(`\\w+_${scope}`)).test(el.tagName.toLowerCase()));
    nijorComponents.forEach(component => {
        let componentName = component.tagName.toLowerCase();
        let componentNameOriginal = componentName.split('_')[0];
        DeferScripts=`$${componentNameOriginal}.init('${componentName}');await $${componentNameOriginal}.run();`+DeferScripts;
    });

    // Executing the for loops
    VirtualDocument.window.document.body.querySelectorAll('[n-for]').forEach(element=>{
        let fn = element.getAttribute('n-for');
        element.removeAttribute('n-for');
        let argumentsForFunction = "";
        if(element.hasAttribute('nfor-arguments')){
            argumentsForFunction = element.getAttribute('nfor-arguments') || "";
            element.removeAttribute('nfor-arguments');
        }
        DeferScripts+=`await ${fn}(${argumentsForFunction});`;
    });

    template = VirtualDocument.window.document.body.innerHTML;
    template = minifyHTML(template);
    JScode = transpileJScode(JScode);
    DeferScripts = transpileJScode(DeferScripts);
    return {template,JScode,DeferScripts};
}

function getRouteFromFilePath(filepath) {
    filepath = filepath.replace(/\\/g, '/');
    if (filepath.indexOf('src/pages/') == -1) return '/';
    let route = '/' + filepath.split('src/pages/')[1].replace('.nijor', '');
    if (route.endsWith('/') && route != "/") route = route.substring(0, route.length - 1);
    const fragments = route.split('/');
    const lastFragment = fragments[fragments.length - 1];
    let url = '';
    let parentURL = '';

    if (fragments.length > 1 && lastFragment === "index") fragments.pop();
    url = fragments.join('/') || '/';

    global.Slots.forEach(item => {
        if (url.indexOf(item) > -1) {
            parentURL = item;
        }
    });

    return parentURL;
}