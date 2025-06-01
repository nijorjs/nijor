import path from 'path';
import fs from 'fs';

const externalModules = ['assert', 'buffer', 'console', 'constants', 'crypto',
    'domain', 'events', 'http', 'https', 'os', 'path', 'punycode', 'querystring',
    'stream', 'string_decoder', 'timers', 'tty', 'url', 'util', 'vm', 'zlib'];

const defaultExtensions = ['.js', '.json'];

class RollupIncludePaths {

    constructor(options) {
        options = options || {};

        this.projectPaths = options.paths || [''];

        this.cache = {};
        if (options.include) {
            this.copyStaticPathsToCache(options.include);
        }

        this.externalModules = options.external || externalModules;

        this.extensions = options.extensions || defaultExtensions;
        let extensionMatchers = this.extensions.map(e => e.replace('.', '\\.')).join('|');

        this.HAS_EXTENSION = RegExp('(' + extensionMatchers + ')$');
    }

    resolveId(id, origin) {
        origin = origin || false;
        return this.resolveCachedPath(id, origin) || this.searchModule(id, origin);
    }

    options(options) {
        if ('function' === typeof this.externalModules) {
            options.external = this.externalModules;
		} else if (this.externalModules instanceof Array && this.externalModules.length) {
			const external = options.external;
			if ('function' === typeof external) {
				options.external = (id) => external(id) || this.externalModules.indexOf(id) !== -1;
			} else {
				options.external = (external && external instanceof Array ? external : []).concat(this.externalModules);
			}
		}

        return options;
    }

    copyStaticPathsToCache (staticPaths) {
        let cache = this.cache;

        Object.keys(staticPaths).forEach(function (id) {
            var modulePath = staticPaths[id];
            cache[id] = resolveJsExtension(modulePath);
        });

        function resolveJsExtension (file) {
            if ((/\.js$/).test(file) === false) {
                file += '.js';
            }

            return file;
        }
    }

    resolveCachedPath (id, origin) {
        const key = this.getCacheKey(id, origin);

        if (key in this.cache) {
            return this.cache[key];
        }

        return false;
    }

    getCacheKey(id, origin) {
        const isRelativePath = id.indexOf('.') === 0;

        return isRelativePath ? `${origin}:${id}` : id;
    }

    searchModule (file, origin) {
        let newPath =
            this.searchRelativePath(file, origin) ||
            this.searchProjectModule(file, origin);

        if (newPath) {
            let cacheKey = this.getCacheKey(file, origin);
            this.cache[cacheKey] = newPath;

            return newPath;
        }

        return null;
    }

    searchProjectModule (file) {
        let newPath;
        let includePath = this.projectPaths;
        let workingDir = process.cwd();

        for (let i = 0, ii = includePath.length; i < ii ; i++) {
            newPath = this.resolvePath(path.resolve(workingDir, includePath[i], file));
            if (newPath) return newPath;
            newPath = this.resolvePath(path.resolve(workingDir, includePath[i], file, 'index'));
            if (newPath) return newPath;
        }

        return null;
    }

    searchRelativePath (file, origin) {
        if (!origin) return null;

        let basePath = path.dirname(origin);

        return (
            this.resolvePath(path.join(basePath, file)) ||
            this.resolvePath(path.join(basePath, file, 'index'))
        );
    }

    resolvePath (file) {
        if (this.fileExists(file)) {
            return file;
        }

        for (let i = 0, ii = this.extensions.length; i < ii; i++ ) {
            let ext = this.extensions[i];
            let newPath = file + ext;

            if (this.fileExists(newPath)) {
                return newPath;
            }
        }

        return false;
    }

    hasExtension (file) {
        return this.HAS_EXTENSION.test(file);
    }

    fileExists (file) {
        try {
            let stat = fs.statSync(file);
            return stat.isFile();
        } catch (e) {
            return false;
        }
    }
}

export default options => {
    let resolver = new RollupIncludePaths(options);

    return {
        resolveId: function (file, origin) {
            return resolver.resolveId(file, origin);
        },

        options: function (options) {
            return resolver.options(options);
        }
    };
}