export function minifyHTML(html) {
    // Regex to match <pre> and <code> blocks
    const regex = /(<(pre|code)[^>]*>)([\s\S]*?)(<\/\2>)/gi;

    // Store the content of <pre> and <code> tags
    const placeholders = [];
    html = html.replace(regex, (match, startTag, tagName, content, endTag) => {
        const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
    });

    // Remove unnecessary whitespace (spaces, tabs, newlines)
    html = html.replace(/\s{2,}/g, ' ')  // Replace multiple spaces with a single space
        .replace(/>\s+</g, '><')   // Remove spaces between tags
        .trim();                   // Remove leading/trailing whitespace

    // Restore the original <pre> and <code> content
    placeholders.forEach((original, index) => {
        const placeholder = `__PLACEHOLDER_${index}__`;
        html = html.replace(placeholder, original);
    });

    return deepFixInterpolations(html);
}

export function deepFixInterpolations(html) {
    const HTML_ENTITIES = {
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': ' ',
    };

    const unescapeEntities = str =>
        str.replace(/&(?:lt|gt|amp|quot|apos|#39|nbsp);/g, match => HTML_ENTITIES[match] ?? match);

    let result = '';
    let i = 0;

    while (i < html.length) {
        if (html.slice(i, i + 2) === '${') {
            let start = i;
            let braceDepth = 0;

            for (let j = i + 2; j < html.length; j++) {
                if (html[j] === '{') braceDepth++;
                if (html[j] === '}') {
                    if (braceDepth === 0) {
                        result += unescapeEntities(html.slice(start, j + 1));
                        i = j + 1;
                        break;
                    }
                    braceDepth--;
                }
            }
        } else {
            result += html[i];
            i++;
        }
    }

    return result;
}