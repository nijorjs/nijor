import { resolve, win32, posix, isAbsolute } from 'path';
import pm from 'picomatch';

const normalizePathRegExp = new RegExp(`\\${win32.sep}`, 'g');

const normalizePath = function normalizePath(filename) {
  return filename.replace(normalizePathRegExp, posix.sep);
};

function isArray(arg){
    return Array.isArray(arg);
}
  
function ensureArray(thing){
    if (isArray(thing)) return thing;
    if (thing == null) return [];
    return [thing];
}

function getMatcherString(id, resolutionBase) {
  if (resolutionBase === false || isAbsolute(id) || id.startsWith('**')) return normalizePath(id);
  const basePath = normalizePath(resolve(resolutionBase || '')).replace(/[-^$*+?.()|[\]{}]/g, '\\$&');
  return posix.join(basePath, normalizePath(id));
}

const createFilter = function createFilter(include, exclude, options) {
  const resolutionBase = options && options.resolve;

  const getMatcher = (id) =>
    id instanceof RegExp
      ? id
      : {
          test: (what) => {
            const pattern = getMatcherString(id, resolutionBase);
            const fn = pm(pattern, { dot: true });
            const result = fn(what);

            return result;
          }
        };

  const includeMatchers = ensureArray(include).map(getMatcher);
  const excludeMatchers = ensureArray(exclude).map(getMatcher);

  if (!includeMatchers.length && !excludeMatchers.length)
    return (id) => typeof id === 'string' && !id.includes('\0');

  return function result(id) {
    if (typeof id !== 'string') return false;
    if (id.includes('\0')) return false;

    const pathId = normalizePath(id);

    for (let i = 0; i < excludeMatchers.length; ++i) {
      const matcher = excludeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId)) return false;
    }

    for (let i = 0; i < includeMatchers.length; ++i) {
      const matcher = includeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId)) return true;
    }

    return !includeMatchers.length;
  };
};

export default createFilter;