const isWordChar = (char) => /\w/.test(char);
const getReactiveVarName = (varname, scope) => `$_${varname}_${scope}`;

function transpileJScode(code, scope, reactive) {
    let result = '';
    let deferInitVars = '';
    let i = 0;
    let inString = false;
    let stringQuote = null;
    let inTemplate = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1];

        // Handle single-line comments
        if (!inString && !inTemplate && !inMultiLineComment && char === '/' && nextChar === '/') {
            inSingleLineComment = true;
            result += '//';
            i += 2;
            continue;
        }
        if (inSingleLineComment && char === '\n') {
            inSingleLineComment = false;
            result += char;
            i++;
            continue;
        }
        if (inSingleLineComment) {
            result += char;
            i++;
            continue;
        }

        // Handle multi-line comments
        if (!inString && !inTemplate && !inSingleLineComment && char === '/' && nextChar === '*') {
            inMultiLineComment = true;
            result += '/*';
            i += 2;
            continue;
        }
        if (inMultiLineComment && char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            result += '*/';
            i += 2;
            continue;
        }
        if (inMultiLineComment) {
            result += char;
            i++;
            continue;
        }

        // Handle string literals
        if (!inSingleLineComment && !inMultiLineComment && !inString && !inTemplate && (char === '"' || char === "'" || char === '`')) {
            inString = char !== '`';
            inTemplate = char === '`';
            stringQuote = char;
            result += char;
            i++;
            continue;
        }

        if (inString && char === stringQuote && code[i - 1] !== '\\') {
            inString = false;
            result += char;
            i++;
            continue;
        }

        if (inTemplate && char === stringQuote && code[i - 1] !== '\\') {
            inTemplate = false;
            result += char;
            i++;
            continue;
        }

        if (inTemplate && char === '$' && nextChar === '{') {
            result += char;
            i++;
            continue;
        }

        // Skip content inside strings and templates
        if (inString || inTemplate) {
            result += char;
            i++;
            continue;
        }

        // Handle variable declarations: let|const|var @varname = value;
        if (code.slice(i).match(/^(let|const|var)\s+@(\w+)\s*=\s*[^;]+;/) && (i === 0 || !isWordChar(code[i - 1]))) {
            const match = code.slice(i).match(/^(let|const|var)\s+@(\w+)\s*=\s*([^;]+);/);
            const [, declType, varname, value] = match;
            const $variable = getReactiveVarName(varname, scope);

            // Transform value by replacing @varname with $_varname_scope.value and handle template literals
            let transformedValue = '';
            let dependentCallbackValue = '';
            let dependencies = [];
            let functionName = null;
            let methodName = null;
            let functionArgs = [];

            // Check for function call, method call, or template literal
            const functionMatch = value.trim().match(/^(\w+)\s*\((.*)\)$/);
            const methodMatch = value.trim().match(/^(`[^`]+`)\s*\.\s*(\w+)\s*\(\)$/);
            let innerValue = value.trim();

            if (functionMatch) {
                functionName = functionMatch[1];
                innerValue = functionMatch[2];
                // Parse function arguments
                let arg = '';
                let parenCount = 0;
                let inArgString = false;
                let argStringQuote = null;
                let inArgTemplate = false;
                for (let j = 0; j < innerValue.length; j++) {
                    const c = innerValue[j];
                    if (!inArgString && !inArgTemplate && c === '(') parenCount++;
                    if (!inArgString && !inArgTemplate && c === ')') parenCount--;
                    if (!inArgString && !inArgTemplate && c === ',' && parenCount === 0) {
                        functionArgs.push(arg.trim());
                        arg = '';
                        continue;
                    }
                    if (!inArgString && !inArgTemplate && (c === '"' || c === "'" || c === '`')) {
                        inArgString = c !== '`';
                        inArgTemplate = c === '`';
                        argStringQuote = c;
                    } else if ((inArgString || inArgTemplate) && c === argStringQuote && innerValue[j - 1] !== '\\') {
                        inArgString = false;
                        inArgTemplate = false;
                    }
                    arg += c;
                }
                if (arg.trim()) functionArgs.push(arg.trim());
            } else if (methodMatch) {
                innerValue = methodMatch[1];
                methodName = methodMatch[2];
            } else {
                innerValue = value.trim();
            }

            // Process innerValue or function arguments
            if (functionName && functionArgs.length > 0) {
                // Transform each argument
                const transformedArgs = functionArgs.map(arg => {
                    if (arg.startsWith('`')) {
                        // Handle template literal argument
                        let templateContent = arg.slice(1, -1);
                        let transformedTemplate = '';
                        let k = 0;
                        let j = 0;
                        while (k < templateContent.length) {
                            if (templateContent[k] === '$' && templateContent[k + 1] === '{' && templateContent[k - 1] !== '\\') {
                                transformedTemplate += templateContent.slice(j, k);
                                let exprStart = k + 2;
                                let braceCount = 1;
                                let m = exprStart;
                                while (m < templateContent.length && braceCount > 0) {
                                    if (templateContent[m] === '{' && templateContent[m - 1] !== '\\') braceCount++;
                                    if (templateContent[m] === '}' && templateContent[m - 1] !== '\\') braceCount--;
                                    m++;
                                }
                                let expr = templateContent.slice(exprStart, m - 1);
                                k = m;
                                let transformedExpr = '';
                                let n = 0;
                                while (n < expr.length) {
                                    if (expr[n] === '"' || expr[n] === "'" || expr[n] === '`') {
                                        let quote = expr[n];
                                        transformedExpr += quote;
                                        let p = n + 1;
                                        while (p < expr.length && (expr[p] !== quote || expr[p - 1] === '\\')) {
                                            transformedExpr += expr[p];
                                            p++;
                                        }
                                        if (p < expr.length) transformedExpr += expr[p];
                                        n = p + 1;
                                        continue;
                                    }
                                    if (
                                        expr[n] === '@' &&
                                        n + 1 < expr.length &&
                                        /\w/.test(expr[n + 1]) &&
                                        (n === 0 || !isWordChar(expr[n - 1])) &&
                                        expr.slice(n).match(/^@(\w+)\b/)
                                    ) {
                                        const varMatch = expr.slice(n).match(/^@(\w+)\b/);
                                        const depVarname = varMatch[1];
                                        if (!dependencies.includes(depVarname)) dependencies.push(depVarname);
                                        const $depVariable = getReactiveVarName(depVarname, scope);
                                        transformedExpr += `${$depVariable}.value`;
                                        n += varMatch[0].length;
                                        continue;
                                    }
                                    transformedExpr += expr[n];
                                    n++;
                                }
                                transformedTemplate += '${' + transformedExpr + '}';
                                j = k;
                                continue;
                            }
                            k++;
                        }
                        transformedTemplate += templateContent.slice(j);
                        return '`' + transformedTemplate + '`';
                    } else {
                        // Handle other arguments (e.g., @varname, literals, expressions)
                        let transformedArg = '';
                        let n = 0;
                        while (n < arg.length) {
                            if (arg[n] === '"' || arg[n] === "'" || arg[n] === '`') {
                                let quote = arg[n];
                                transformedArg += quote;
                                let p = n + 1;
                                while (p < arg.length && (arg[p] !== quote || arg[p - 1] === '\\')) {
                                    transformedArg += arg[p];
                                    p++;
                                }
                                if (p < arg.length) transformedArg += arg[p];
                                n = p + 1;
                                continue;
                            }
                            if (
                                arg[n] === '@' &&
                                n + 1 < arg.length &&
                                /\w/.test(arg[n + 1]) &&
                                (n === 0 || !isWordChar(arg[n - 1])) &&
                                arg.slice(n).match(/^@(\w+)\b/)
                            ) {
                                const varMatch = arg.slice(n).match(/^@(\w+)\b/);
                                const depVarname = varMatch[1];
                                if (!dependencies.includes(depVarname)) dependencies.push(depVarname);
                                const $depVariable = getReactiveVarName(depVarname, scope);
                                transformedArg += `${$depVariable}.value`;
                                n += varMatch[0].length;
                                continue;
                            }
                            transformedArg += arg[n];
                            n++;
                        }
                        return transformedArg;
                    }
                });
                transformedValue = `${functionName}(${transformedArgs.join(', ')})`;
                dependentCallbackValue = transformedValue;
            } else if (innerValue.startsWith('`')) {
                // Handle template literal
                let templateContent = innerValue.slice(1, -1);
                let transformedTemplate = '';
                let callbackTemplate = '`' + templateContent + '`';
                let k = 0;
                let j = 0;
                while (k < templateContent.length) {
                    if (templateContent[k] === '$' && templateContent[k + 1] === '{' && templateContent[k - 1] !== '\\') {
                        transformedTemplate += templateContent.slice(j, k);
                        let exprStart = k + 2;
                        let braceCount = 1;
                        let m = exprStart;
                        while (m < templateContent.length && braceCount > 0) {
                            if (templateContent[m] === '{' && templateContent[m - 1] !== '\\') braceCount++;
                            if (templateContent[m] === '}' && templateContent[m - 1] !== '\\') braceCount--;
                            m++;
                        }
                        let expr = templateContent.slice(exprStart, m - 1);
                        k = m;
                        let transformedExpr = '';
                        let n = 0;
                        while (n < expr.length) {
                            if (expr[n] === '"' || expr[n] === "'" || expr[n] === '`') {
                                let quote = expr[n];
                                transformedExpr += quote;
                                let p = n + 1;
                                while (p < expr.length && (expr[p] !== quote || expr[p - 1] === '\\')) {
                                    transformedExpr += expr[p];
                                    p++;
                                }
                                if (p < expr.length) transformedExpr += expr[p];
                                n = p + 1;
                                continue;
                            }
                            if (
                                expr[n] === '@' &&
                                n + 1 < expr.length &&
                                /\w/.test(expr[n + 1]) &&
                                (n === 0 || !isWordChar(expr[n - 1])) &&
                                expr.slice(n).match(/^@(\w+)\b/)
                            ) {
                                const varMatch = expr.slice(n).match(/^@(\w+)\b/);
                                const depVarname = varMatch[1];
                                if (!dependencies.includes(depVarname)) dependencies.push(depVarname);
                                const $depVariable = getReactiveVarName(depVarname, scope);
                                transformedExpr += `${$depVariable}.value`;
                                n += varMatch[0].length;
                                continue;
                            }
                            transformedExpr += expr[n];
                            n++;
                        }
                        transformedTemplate += '${' + transformedExpr + '}';
                        j = k;
                        continue;
                    }
                    k++;
                }
                transformedTemplate += templateContent.slice(j);
                transformedValue = '`' + transformedTemplate + '`';
                if (methodName) {
                    transformedValue = `${transformedValue}.${methodName}()`;
                }
                let callbackTransformed = '';
                let q = 0;
                while (q < callbackTemplate.length) {
                    if (callbackTemplate[q] === '$' && callbackTemplate[q + 1] === '{' && callbackTemplate[q - 1] !== '\\') {
                        callbackTransformed += callbackTemplate.slice(0, q);
                        let exprStart = q + 2;
                        let braceCount = 1;
                        let r = exprStart;
                        while (r < callbackTemplate.length && braceCount > 0) {
                            if (callbackTemplate[r] === '{' && callbackTemplate[r - 1] !== '\\') braceCount++;
                            if (callbackTemplate[r] === '}' && callbackTemplate[r - 1] !== '\\') braceCount--;
                            r++;
                        }
                        let expr = callbackTemplate.slice(exprStart, r - 1);
                        let transformedExpr = '';
                        let s = 0;
                        while (s < expr.length) {
                            if (expr[s] === '@' && s + 1 < expr.length && /\w/.test(expr[s + 1]) && (s === 0 || !isWordChar(expr[s - 1])) && expr.slice(s).match(/^@(\w+)\b/)) {
                                const varMatch = expr.slice(s).match(/^@(\w+)\b/);
                                const depVarname = varMatch[1];
                                const $depVariable = getReactiveVarName(depVarname, scope);
                                transformedExpr += `${$depVariable}.value`;
                                s += varMatch[0].length;
                                continue;
                            }
                            transformedExpr += expr[s];
                            s++;
                        }
                        callbackTransformed += '${' + transformedExpr + '}';
                        callbackTemplate = callbackTemplate.slice(r);
                        q = 0;
                        continue;
                    }
                    q++;
                }
                callbackTransformed += callbackTemplate;
                dependentCallbackValue = callbackTransformed;
                if (methodName) {
                    dependentCallbackValue = `${dependentCallbackValue}.${methodName}()`;
                }
            } else {
                // Handle non-template literal expressions (e.g., Lower(@fname) + Lower(@lname))
                let j = 0;
                let expr = innerValue;
                while (j < expr.length) {
                    if (expr[j] === '"' || expr[j] === "'" || expr[j] === '`') {
                        let quote = expr[j];
                        transformedValue += quote;
                        let k = j + 1;
                        while (k < expr.length && (expr[k] !== quote || expr[k - 1] === '\\')) {
                            transformedValue += expr[k];
                            k++;
                        }
                        if (k < expr.length) transformedValue += expr[k];
                        j = k + 1;
                        continue;
                    }
                    if (
                        expr[j] === '@' &&
                        j + 1 < expr.length &&
                        /\w/.test(expr[j + 1]) &&
                        (j == 0 || !isWordChar(expr[j - 1])) &&
                        expr.slice(j).match(/^@(\w+)\b/)
                    ) {
                        const varMatch = expr.slice(j).match(/^@(\w+)\b/);
                        const depVarname = varMatch[1];
                        if (!dependencies.includes(depVarname)) dependencies.push(depVarname);
                        const $depVariable = getReactiveVarName(depVarname, scope);
                        transformedValue += `${$depVariable}.value`;
                        j += varMatch[0].length;
                        continue;
                    }
                    transformedValue += expr[j];
                    j++;
                }
                dependentCallbackValue = transformedValue;
            }

            // Generate declaration
            result += `const ${$variable} = ${reactive}(${transformedValue},'${varname}','${scope}');\n`;
            deferInitVars += `${$variable}.init();\n`;

            // Add dependencies directly to result
            if (dependencies.length > 0) {
                dependencies.forEach(depVarname => {
                    const $depVariable = getReactiveVarName(depVarname, scope);
                    result += `${$depVariable}.subscribe(value => ${$variable}.value = ${dependentCallbackValue});\n`;
                });
            }

            i += match[0].length;
            continue;
        }

        // Handle assignments and operations: @varname = value; or @varname++;
        if (!inSingleLineComment && !inMultiLineComment && code.slice(i).match(/^@(\w+)((?:\++|--)|(?:\s*=\s*[^;]+));/) && (i === 0 || !isWordChar(code[i - 1]))) {
            const match = code.slice(i).match(/^@(\w+)((?:\++|--)|(?:\s*=\s*[^;]+));/);
            const [, varname, operation] = match;
            const $variable = getReactiveVarName(varname, scope);
            if (operation === '++' || operation === '--') {
                result += `${$variable}.value${operation};`;
            } else {
                const [, value] = operation.trim().split(/\s*=\s*/);
                result += `${$variable}.value = ${value};`;
            }
            i += match[0].length;
            continue;
        }

        // Handle standalone variable references: @varname
        if (!inSingleLineComment && !inMultiLineComment && code.slice(i).match(/^@(\w+)\b(?!\s*(?:=|\++|--|[+\-*/%]=))/) && (i === 0 || !isWordChar(code[i - 1]))) {
            const match = code.slice(i).match(/^@(\w+)\b/);
            const [, varname] = match;
            result += `${getReactiveVarName(varname, scope)}.value`;
            i += match[0].length;
            continue;
        }

        result += char;
        i++;
    }

    return [result, deferInitVars];
}

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

export default function (document, prescript, deferscript, scope) {

    if(!hasReactiveVariables(prescript)) {
        return { transformedHTML : document.innerHTML, prescript, deferscript };
    }

    const elements = Array.from(document.querySelectorAll('*')).filter(element => {
        // Get only the direct text content (not from child elements)
        const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join('');
        // Check for '${@...}' pattern but not preceded by '\'
        return textNodes.match(/(?<!\\)\${@[^}]+}/);
    });

    const InputBindElements = document.querySelectorAll('input[n:bind]');

    elements.forEach(element => {
        const variables = Array.from(element.innerHTML.matchAll(/(?<!\\){@([^}]+)}/g), match => match[1]);
        for (let i of variables) {
            let className = `_${i}_${scope}`;
            element.classList.add(className);
            element.innerHTML = element.innerHTML.replace(`\$\{@${i}}`, `<!--${i}@${scope}--><!--/-->`);
        }
    });

    InputBindElements.forEach(element => {
        const bindVariable = element.getAttribute('n:bind').replace('@', '');
        const eventName = `${bindVariable}@${scope}`;
        element.removeAttribute('n:bind');

        prescript += `
        window.eventStorage['${eventName}'] = function (_this){
            $_${bindVariable}_${scope}.value = _this.value;
        }`;

        element.setAttribute('oninput', `window.eventStorage['${eventName}'](this)`);
    });

    const transformedHTML = document.innerHTML;

    const reactive = `_$reactive_${scope}`;
    prescript = `import {reactive as ${reactive}} from "nijor/reactivity";` + prescript;
    let [transpiledCode, deferInitVars] = transpileJScode(prescript, scope, reactive);
    prescript = transpiledCode;
    deferscript = transpileJScode(deferscript, scope, reactive)[0] + deferInitVars;

    return { transformedHTML, prescript, deferscript };
}