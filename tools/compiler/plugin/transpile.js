function removeComments(code) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1];

    if (inString) {
      result += char;
      if (!escaped && char === stringChar) {
        inString = false;
      }
      escaped = char === '\\' && !escaped;
    } else if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
        result += '\n';
      }
    } else if (inMultiLineComment) {
      if (char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i++; // Skip '/'
      }
    } else {
      if ((char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        i++; // Skip nextChar
      } else if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i++; // Skip nextChar
      } else {
        result += char;
      }
    }
  }

  // Remove empty lines (after comment removal)
  return result
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
}

function $declaration(code,scope,reactive) {
  let lines = code.split('\n');
  let result = [];
  let reactiveVars = new Set();
  let deferInit = '';

  // Helper to check if a string is a valid JS expression
  function isValidExpression(str) {
    return str.trim() && !str.match(/^(?:['"`]|\/\/|\/\*)/);
  }

  // Helper to transform @varname to $_varname.value in an expression
  function transformExpression(expr) {
    let transformed = '';
    let i = 0;
    let inString = false;
    let stringChar = null;
    let inTemplate = false;
    let inTemplateExpr = false;
    let braceCount = 0;

    while (i < expr.length) {
      if (expr[i] === '\\') {
        transformed += expr[i] + (expr[i + 1] || '');
        i += 2;
        continue;
      }
      if ((expr[i] === '"' || expr[i] === "'" || expr[i] === '`') && expr[i - 1] !== '\\') {
        if (!inString && !inTemplate) {
          inString = expr[i] !== '`';
          inTemplate = expr[i] === '`';
          stringChar = expr[i];
        } else if (stringChar === expr[i]) {
          inString = false;
          inTemplate = false;
          stringChar = null;
        }
        transformed += expr[i];
        i++;
        continue;
      }
      if (inTemplate && expr[i] === '$' && expr[i + 1] === '{' && expr[i - 1] !== '\\') {
        inTemplateExpr = true;
        braceCount = 1;
        transformed += '${';
        i += 2;
        let exprStart = i;
        while (i < expr.length && braceCount > 0) {
          if (expr[i] === '{') braceCount++;
          if (expr[i] === '}') braceCount--;
          i++;
        }
        if (braceCount === 0) {
          let subExpr = expr.slice(exprStart, i - 1);
          transformed += transformExpression(subExpr) + '}';
          inTemplateExpr = false;
        }
        continue;
      }
      if (expr[i] === '@' && !inString && !inTemplate) {
        i++;
        let varName = '';
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
          varName += expr[i];
          i++;
        }
        if (reactiveVars.has(varName)) {
          transformed += `$_${varName}_${scope}.value`;
        } else {
          transformed += `@${varName}`;
        }
        continue;
      }
      transformed += expr[i];
      i++;
    }
    return transformed;
  }

  // Helper to find @varname dependencies in an expression
  function findDependencies(expr) {
    let dependencies = new Set();
    let i = 0;
    let inString = false;
    let stringChar = null;
    let inTemplate = false;
    let inTemplateExpr = false;
    let braceCount = 0;

    while (i < expr.length) {
      if (expr[i] === '\\') {
        i += 2;
        continue;
      }
      if ((expr[i] === '"' || expr[i] === "'" || expr[i] === '`') && expr[i - 1] !== '\\') {
        if (!inString && !inTemplate) {
          inString = expr[i] !== '`';
          inTemplate = expr[i] === '`';
          stringChar = expr[i];
        } else if (stringChar === expr[i]) {
          inString = false;
          inTemplate = false;
          stringChar = null;
        }
        i++;
        continue;
      }
      if (inTemplate && expr[i] === '$' && expr[i + 1] === '{' && expr[i - 1] !== '\\') {
        inTemplateExpr = true;
        braceCount = 1;
        i += 2;
        let exprStart = i;
        while (i < expr.length && braceCount > 0) {
          if (expr[i] === '{') braceCount++;
          if (expr[i] === '}') braceCount--;
          i++;
        }
        if (braceCount === 0) {
          let subExpr = expr.slice(exprStart, i - 1);
          findDependencies(subExpr).forEach(dep => dependencies.add(dep));
          inTemplateExpr = false;
        }
        continue;
      }
      if (expr[i] === '@' && !inString && !inTemplate) {
        i++;
        let varName = '';
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
          varName += expr[i];
          i++;
        }
        if (reactiveVars.has(varName)) {
          dependencies.add(varName);
        }
      } else {
        i++;
      }
    }
    return dependencies;
  }

  for (let line of lines) {
    let trimmedLine = line.trim();
    // Skip empty lines or comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      result.push(line);
      continue;
    }

    // Match const @varname = value;
    let match = trimmedLine.match(/^(const|let)\s+@(\w+)\s*=\s*([^;]+);$/);
    if (match) {
      let bool = match[1] === 'const' ? true : false;
      let varName = match[2];
      let value = match[3].trim();
      reactiveVars.add(varName);
      let transformedValue = transformExpression(value);
      result.push(`const $_${varName}_${scope} = ${reactive}(${transformedValue});`);
      deferInit+=`$_${varName}_${scope}.init(${bool});`;
      // Generate subscriptions for dependencies
      let dependencies = findDependencies(value);
      dependencies.forEach(dep => {
        result.push(`$_${dep}_${scope}.subscribe(() => $_${varName}_${scope}.value = ${transformedValue});`);
      });
    } else {
      // Preserve non-const lines without transformation
      result.push(line);
    }
  }

  return [result.join('\n'),deferInit];
}

export function $reference(code,scope) {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = null;
  let inTemplate = false;
  let inTemplateExpr = false;
  let braceCount = 0;
  let stringStart = 0;

  while (i < code.length) {
    // Handle string literals
    if (!inString && !inTemplate && (code[i] === '"' || code[i] === "'" || code[i] === '`')) {
      inString = code[i] !== '`';
      inTemplate = code[i] === '`';
      stringChar = code[i];
      stringStart = i;
      i++;
      continue;
    }
    if (inString || inTemplate) {
      if (code[i] === '\\') {
        i += 2; // Skip escaped character
        continue;
      }
      if (code[i] === stringChar && code[i - 1] !== '\\') {
        inString = false;
        inTemplate = false;
        stringChar = null;
        result += code.slice(stringStart, i + 1);
        i++;
        continue;
      }
      if (inTemplate && code[i] === '$' && code[i + 1] === '{' && code[i - 1] !== '\\') {
        inTemplateExpr = true;
        braceCount = 1;
        result += code.slice(stringStart, i) + '${';
        i += 2;
        stringStart = i;
        let exprStart = i;
        while (i < code.length && braceCount > 0) {
          if (code[i] === '{') braceCount++;
          if (code[i] === '}') braceCount--;
          i++;
        }
        if (braceCount === 0) {
          let subExpr = code.slice(exprStart, i - 1);
          result += $reference(subExpr,scope) + '}';
          inTemplateExpr = false;
          stringStart = i;
        }
        continue;
      }
      i++;
      continue;
    }

    // Check for @varname or @varname.subscribe
    if (code[i] === '@') {
      const start = i;
      i++;
      let varName = '';
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        varName += code[i];
        i++;
      }
      let isSubscribe = false;
      if (code.slice(i, i + 10) === '.subscribe') {
        isSubscribe = true;
        i += 10;
      }
      if (varName) {
        if (isSubscribe) {
          result += `$_${varName}_${scope}.subscribe`;
        } else {
          result += `$_${varName}_${scope}.value`;
        }
      } else {
        result += '@'; // Lone @ symbol
      }
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}

export function $import(code,scope,seed) {
  let lines = code.split('\n');
  let result = [];

  // Helper to transform @varname as @alias to $_varname_seed as $_alias in import specifiers
  function transformSpecifiers(specifiers) {
    return specifiers.split(',').map(specifier => {
      let trimmed = specifier.trim();
      // Match @varname or @varname as @alias
      let match = trimmed.match(/^@(\w+)(?:\s+as\s+@(\w+))?$/);
      if (match) {
        let varName = match[1];
        let alias = match[2] || varName; // Use varName if no alias
        return `$_${varName}_${seed} as $_${alias}_${scope}`;
      }
      return trimmed;
    }).join(', ');
  }

  for (let line of lines) {
    let trimmedLine = line.trim();
    // Skip empty lines or comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      result.push(line);
      continue;
    }

    // Match import { ... } from '...';
    let match = trimmedLine.match(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;$/);
    if (match) {
      let specifiers = match[1];
      let source = match[2];
      let transformedSpecifiers = transformSpecifiers(specifiers);
      result.push(`import { ${transformedSpecifiers} } from '${source}';`);
    } else {
      // Preserve non-matching lines (including strings containing @varname)
      result.push(line);
    }
  }

  return result.join('\n');
}

function $export(code,scope,seed) {
  let lines = code.split('\n');
  let result = [];

  // Helper to transform @varname or @varname as @alias to $_varname as $_alias_seed in export specifiers
  function transformSpecifiers(specifiers) {
    return specifiers.split(',').map(specifier => {
      let trimmed = specifier.trim();
      // Match @varname or @varname as @alias
      let match = trimmed.match(/^@(\w+)(?:\s+as\s+@(\w+))?$/);
      if (match) {
        let varName = match[1];
        let alias = match[2] || varName; // Use varName if no alias
        return `$_${varName}_${scope} as $_${alias}_${seed}`;
      }
      return trimmed;
    }).join(', ');
  }

  for (let line of lines) {
    let trimmedLine = line.trim();
    // Skip empty lines or comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      result.push(line);
      continue;
    }

    // Match export { ... };
    let match = trimmedLine.match(/^export\s*\{([^}]+)\}\s*;$/);
    if (match) {
      let specifiers = match[1];
      let transformedSpecifiers = transformSpecifiers(specifiers);
      result.push(`export { ${transformedSpecifiers} };`);
    } else {
      // Preserve non-matching lines (including strings containing @varname)
      result.push(line);
    }
  }

  return result.join('\n');
}

export function transpile(code, scope, reactive,seed) {
  let deferInit;
  code = removeComments(code);
  code = $import(code,scope,seed);
  code = $export(code,scope,seed);
  [code,deferInit] = $declaration(code,scope,reactive);
  code = $reference(code, scope, reactive);
  return {code,deferInit};
}