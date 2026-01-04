import fs from 'fs';
import path from 'path';

function replace(propString, vars) {
    const keys = Object.keys(vars);
    
    if (keys.length === 0) {
        return propString;
    }

    const sortedEscapedKeys = keys.sort((a, b) => b.length - a.length).map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const variablePattern = sortedEscapedKeys.join('|');
    const isolatedVarRegex = new RegExp(`(?<![a-zA-Z0-9_-])` + `(${variablePattern})` + `(?![a-zA-Z0-9_-])`, 'g');
    
    const propertyValueRegex = new RegExp(`([^:]+:\\s*)` + `([^;]+)`, 'g');

    const finalResult = propString.replace(propertyValueRegex, (fullMatch, propertyAndColon, valueExpression) => {
     
        const substitutedValue = valueExpression.replace(isolatedVarRegex, (match, variableName) => {
            
            let value = vars[variableName];

            if (value !== undefined && value !== null) {
                return value.toString();
            }

            return match; 
        });
        
        return propertyAndColon + substitutedValue;
    });

    return finalResult;
}

function extract_css_block(cssLikeCode, blockName) {

    if (!/^[a-zA-Z]/.test(blockName)) {
        console.error(`Error: Block name must start with an alphabet (A-Z or a-z). Invalid blockName: ${blockName}`);
        return null;
    }

    const escapedBlockName = blockName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    const simplerRegex = new RegExp(`(^|\\s)(${escapedBlockName}(\\([^\\)]*\\))?\\s*\\{[\\s\\S]*?\\})`);

    const match = simplerRegex.exec(cssLikeCode);

    if (match && match.length > 2) {
        return match[2].trim();
    }

    return null;
}


export function compile_nst(modules_path,styles){
    
    const files = {};
    let code = ``;

    styles.forEach(style=>{
        
        if (style.indexOf('.') == -1){
            style = `${style}.main` ;
        }

        let [mod,classname] = style.split('.');
        let prefix = null;

        if(style.indexOf(':')>-1){
            [prefix,mod] = mod.split(':');
        }

        const modPath = path.join(modules_path,mod)+'.nst';
        if(!fs.existsSync(modPath)) return;

        const file = files[mod] || fs.readFileSync(modPath,'utf-8');
        files[mod] = file;

        if(classname.indexOf('(') == -1){
            let cssBlock = extract_css_block(file,classname);
            if(!cssBlock) return;
            if(!prefix){
                code += `.${mod}-${classname}{ ${peek_inside_braces(cssBlock)} }`;
            }else{
                code += `.${mod}-${prefix}-${classname}:${prefix}{ ${peek_inside_braces(cssBlock)} }`;
            }
            return;
        }

        const blockName = classname.split('(')[0];
        const newclass = classname.replace('(','-').replace(')','').replace(',','-').replace('%',`${process.seed}_pct`);
        let cssBlock = extract_css_block(file,blockName);
        let cssProps = peek_inside_braces(cssBlock);
        let paramValues = peek_inside_parenthesis(classname);
        let paramNames = peek_inside_parenthesis(cssBlock.split('{')[0]);
        let vars = {};

        if(paramNames.length != paramValues.length) return;

        for (let index = 0; index < paramValues.length; index++) {
            vars[paramNames[index]] = paramValues[index];
        }
        
        if(!prefix){
            code += `.${mod}-${newclass}{ ${replace(cssProps, vars)} }`;
        }else{
            code += `.${mod}-${prefix}-${newclass}:${prefix}{ ${replace(cssProps, vars)} }`;
        }
        
    });

    return code;
}

function peek_inside_braces(str){
    return str.match(/\{([^{}]+)\}/)[1];
}

function peek_inside_parenthesis(str){
    const regex = /\(([^)]+)\)/;
    const match = str.match(regex);
    return match[1].split(',');
}

export function rename_class(str){
    if (str.indexOf('.')==-1){
        return `${str}.main`;
    }

    let [mod,classname] = str.split('.');
    let prefix = null;

    if(str.indexOf(':')>-1){
        [prefix,mod] = mod.split(':');
    }

    classname = classname?.replace('(','-').replace(')','').replace(',','-').replace('%',`${process.seed}_pct`);

    if(!prefix){
        return `${mod}-${classname}`;
    }
    return `${mod}-${prefix}-${classname}`;
}