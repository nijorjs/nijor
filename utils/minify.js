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

    return html;
}

export function minifyCSS(css){
    return css
        .replace(/\/\*[^*]*\*+([^/][^*]*\*+)*/g, '') // Remove comments
        .replace(/\s*([{};:,])\s*/g, '$1')           // Remove whitespace around symbols
        .replace(/;}/g, '}')                           // Remove unnecessary semicolons
        .replace(/\s+/g, ' ')                         // Collapse remaining whitespace
        .trim();
}