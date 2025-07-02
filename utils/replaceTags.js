export function replaceTags(code, oTag, nTag) {
  const regex = new RegExp(`<${oTag}([^>]*)>([\\s\\S]*?)</${oTag}>`, 'gi');
  return code.replace(regex, (match, attrs, content) => `<${nTag}${attrs}>${content}</${nTag}>`);
}