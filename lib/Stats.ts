/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequestShortener = require('./RequestShortener');
import Compilation = require('./Compilation')
import { StatsOptions, PlainObject, WebpackError } from '../typings/webpack-types'
import { formatSize } from './SizeFormatHelpers'
import Module = require('./Module')
import NormalModule = require('./NormalModule')
import ModuleNotFoundError = require('./ModuleNotFoundError');
import ModuleError = require('./ModuleError');
import ModuleBuildError = require('./ModuleBuildError');
import ModuleParseError = require('./ModuleParseError');
import ModuleWarning = require('./ModuleWarning');
import ModuleDependencyWarning = require('./ModuleDependencyWarning');
import Dependency = require('./Dependency');
import Chunk = require('./Chunk');

interface Colors {
    bold(str: string | number): void
    cyan(str: string| number): void
    green(str: string| number): void
    magenta(str: string| number): void
    normal(str: string| number): void
    red(str: string| number): void
    yellow(str: string| number): void
}

interface StatsChunkOrigin {
    loc: string
    module: string
    moduleId: number
    moduleIdentifier: string
    moduleName: string
    name: string
    reasons: string[]
}

interface StatsReason {
    loc?: string
    module: string
    moduleId: number
    moduleIdentifier: string
    moduleName: string
    type: string
    userRequest: string
}

interface StatsModule {
    assets: string[]
    built: boolean
    cacheable: boolean
    chunks: number[]
    errors: number
    failed: boolean
    id: number
    identifier: string
    index2: number
    index: number
    issuer: string
    issuerId: number
    issuerName: string
    name: string
    optional: boolean
    prefetched: boolean
    profile: Module.Profile
    reasons?: StatsReason[]
    size: number
    warnings: number
    usedExports?: string[] | boolean
    providedExports?: string[]
    source?: string
}

interface StatsChunk {
    entry: boolean
    extraAsync: boolean
    files: string[]
    filteredModules?: number
    hash: string
    id: number
    initial: boolean
    loc?: string
    modules?: StatsModule[]
    names: string[]
    origins?: StatsChunkOrigin[]
    parents: number[]
    recorded: boolean
    rendered: boolean
    size: number
}

interface StatsAsset {
    chunkNames: string[]
    chunks: number[]
    emitted: boolean
    name: string
    size: number
    isOverSizeLimit?: boolean
}

interface StatsEntryPoint {
    chunks: number[]
    assets: string[]
    isOverSizeLimit: boolean
}

interface StatsJson {
    _showErrors: boolean
    _showWarnings: boolean
    assets: StatsAsset[]
    assetsByChunkName: Dictionary<string[] | string>
    children: StatsJson[]
    chunks: StatsChunk[]
    entrypoints: Dictionary<StatsEntryPoint>
    errors: string[]
    filteredModules: number
    hash: string
    modules: StatsModule[]
    name: string
    needAdditionalPass: boolean
    publicPath: string
    time: number
    version: string
    warnings: string[]
}

class Stats {
    compilation: Compilation
    endTime: number
    hash: string
    startTime: number

    constructor(compilation: Compilation) {
        this.compilation = compilation;
        this.hash = compilation.hash;
    }

    hasWarnings() {
        return this.compilation.warnings.length > 0;
    }

    hasErrors() {
        return this.compilation.errors.length > 0;
    }

    toJson(options: StatsOptions, forToString: boolean) {
        if (typeof options === 'boolean' || typeof options === 'string') {
            options = Stats.presetToOptions(options);
        }
        else if (!options) {
            options = {} as StatsOptions;
        }

        function d(v: any, def: any) {
            return v === undefined ? def : v;
        }

        const compilation = this.compilation;
        const requestShortener = new RequestShortener(d(options.context, process.cwd()));
        const showPerformance = d(options.performance, true);
        const showHash = d(options.hash, true);
        const showVersion = d(options.version, true);
        const showTimings = d(options.timings, true);
        const showAssets = d(options.assets, true);
        const showEntryPoints = d(options.entrypoints, !forToString);
        const showChunks = d(options.chunks, true);
        const showChunkModules = d(options.chunkModules, !!forToString);
        const showChunkOrigins = d(options.chunkOrigins, !forToString);
        const showModules = d(options.modules, !forToString);
        const showCachedModules = d(options.cached, true);
        const showCachedAssets = d(options.cachedAssets, true);
        const showReasons = d(options.reasons, !forToString);
        const showUsedExports = d(options.usedExports, !forToString);
        const showProvidedExports = d(options.providedExports, !forToString);
        const showChildren = d(options.children, true);
        const showSource = d(options.source, !forToString);
        const showErrors = d(options.errors, true);
        const showErrorDetails = d(options.errorDetails, !forToString);
        const showWarnings = d(options.warnings, true);
        const showPublicPath = d(options.publicPath, !forToString);
        const excludeModules = [].concat(d(options.exclude, [])).map(str => {
            if (typeof str !== 'string') {
                return str;
            }
            return new RegExp(`[\\\\/]${str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}([\\\\/]|$|!|\\?)`);
        });
        const sortModules = d(options.modulesSort, 'id');
        const sortChunks = d(options.chunksSort, 'id');
        const sortAssets = d(options.assetsSort, '');

        function moduleFilter(module: Module) {
            if (!showCachedModules && !module.built) {
                return false;
            }
            if (excludeModules.length === 0) {
                return true;
            }
            const ident = module.resource;
            return !excludeModules.some(regExp => regExp.test(ident));
        }

        function sortByField(field: string) {
            if (!field) {
                return () => 0;
            }
            if (field[0] === '!') {
                field = field.substr(1);
                return (a: PlainObject, b: PlainObject) => {
                    if (a[field] === b[field]) {
                        return 0;
                    }
                    return a[field] < b[field] ? 1 : -1;
                };
            }
            return (a: PlainObject, b: PlainObject) => {
                if (a[field] === b[field]) {
                    return 0;
                }
                return a[field] < b[field] ? -1 : 1;
            };
        }

        function formatError(e: WebpackError | string) {
            let text = '';
            let err: WebpackError = typeof e === 'string' ? {
                    message: e
                } : e;
            if (err.chunk) {
                text += `chunk ${err.chunk.name || err.chunk.id}${err.chunk.hasRuntime()
                    ? ' [entry]'
                    : err.chunk.isInitial()
                        ? ' [initial]'
                        : ''}\n`;
            }
            if (err.file) {
                text += `${err.file}\n`;
            }
            if (err.module && err.module.readableIdentifier && typeof err.module.readableIdentifier === 'function') {
                text += `${err.module.readableIdentifier(requestShortener)}\n`;
            }
            text += err.message;
            if (showErrorDetails && err.details) {
                text += `\n${err.details}`;
            }
            if (showErrorDetails && err.missing) {
                text += err.missing.map(item => `\n[${item}]`).join('');
            }
            if (err.dependencies && err.origin) {
                text += `\n @ ${err.origin.readableIdentifier(requestShortener)}`;
                err.dependencies.forEach(dep => {
                    if (!dep.loc) {
                        return;
                    }
                    if (typeof dep.loc === 'string') {
                        return;
                    }
                    if (!dep.loc.start) {
                        return;
                    }
                    if (!dep.loc.end) {
                        return;
                    }
                    text += ` ${dep.loc.start.line}:${dep.loc.start.column}-${dep.loc.start.line !== dep.loc.end.line
                        ? dep.loc.end.line + ':'
                        : ''}${dep.loc.end.column}`;
                });
                let current = err.origin;
                while (current.issuer) {
                    current = current.issuer;
                    text += `\n @ ${current.readableIdentifier(requestShortener)}`;
                }
            }
            return text;
        }

        const obj: StatsJson = {
            errors: compilation.errors.map(formatError),
            warnings: compilation.warnings.map(formatError)
        } as any;

        // We just hint other renderers since actually omitting
        // errors/warnings from the JSON would be kind of weird.
        Object.defineProperty(obj, '_showWarnings', {
            value: showWarnings,
            enumerable: false
        });
        Object.defineProperty(obj, '_showErrors', {
            value: showErrors,
            enumerable: false
        });

        if (showVersion) {
            obj.version = require('../package.json').version;
        }

        if (showHash) {
            obj.hash = this.hash;
        }
        if (showTimings && this.startTime && this.endTime) {
            obj.time = this.endTime - this.startTime;
        }
        if (compilation.needAdditionalPass) {
            obj.needAdditionalPass = true;
        }
        if (showPublicPath) {
            obj.publicPath = this.compilation.mainTemplate.getPublicPath({
                hash: this.compilation.hash
            });
        }
        if (showAssets) {
            const assetsByFile = {};
            obj.assetsByChunkName = {};
            obj.assets = Object.keys(compilation.assets)
                .map(asset => {
                    const obj = {
                        name: asset,
                        size: compilation.assets[asset].size(),
                        chunks: [] as number[],
                        chunkNames: [] as string[],
                        emitted: compilation.assets[asset].emitted
                    } as StatsAsset;

                    if (showPerformance) {
                        obj.isOverSizeLimit = compilation.assets[asset].isOverSizeLimit;
                    }

                    assetsByFile[asset] = obj;
                    return obj;
                })
                .filter(asset => showCachedAssets || asset.emitted);

            compilation.chunks.forEach(chunk => {
                chunk.files.forEach(asset => {
                    if (assetsByFile[asset]) {
                        chunk.ids.forEach(id => {
                            assetsByFile[asset].chunks.push(id);
                        });
                        if (chunk.name) {
                            assetsByFile[asset].chunkNames.push(chunk.name);
                            if (obj.assetsByChunkName[chunk.name]) {
                                obj.assetsByChunkName[chunk.name] = [].concat(obj.assetsByChunkName[chunk.name])
                                    .concat([asset]);
                            }
                            else {
                                obj.assetsByChunkName[chunk.name] = asset;
                            }
                        }
                    }
                });
            });
            obj.assets.sort(sortByField(sortAssets));
        }

        if (showEntryPoints) {
            obj.entrypoints = {};
            Object.keys(compilation.entrypoints).forEach(name => {
                const ep = compilation.entrypoints[name];
                obj.entrypoints[name] = {
                    chunks: ep.chunks.map(c => c.id),
                    assets: ep.chunks.reduce((array, c) => array.concat(c.files || []), [])
                } as StatsEntryPoint;
                if (showPerformance) {
                    obj.entrypoints[name].isOverSizeLimit = ep.isOverSizeLimit;
                }
            });
        }

        function fnModule(module: NormalModule) {
            const obj: StatsModule = {
                id: module.id,
                identifier: module.identifier(),
                name: module.readableIdentifier(requestShortener),
                index: module.index,
                index2: module.index2,
                size: module.size(),
                cacheable: !!module.cacheable,
                built: !!module.built,
                optional: !!module.optional,
                prefetched: !!module.prefetched,
                chunks: module.chunks.map(chunk => chunk.id),
                assets: Object.keys(module.assets || {}),
                issuer: module.issuer && module.issuer.identifier(),
                issuerId: module.issuer && module.issuer.id,
                issuerName: module.issuer && module.issuer.readableIdentifier(requestShortener),
                profile: module.profile,
                failed: !!module.error,
                errors: module.errors && module.dependenciesErrors && module.errors.length + module.dependenciesErrors.length,
                warnings: module.errors && module.dependenciesErrors && module.warnings.length + module.dependenciesWarnings.length
            };
            if (showReasons) {
                obj.reasons = module.reasons
                    .filter(reason => reason.dependency && reason.module)
                    .map(reason => {
                        const obj: StatsReason = {
                            moduleId: reason.module.id,
                            moduleIdentifier: reason.module.identifier(),
                            module: reason.module.readableIdentifier(requestShortener),
                            moduleName: reason.module.readableIdentifier(requestShortener),
                            type: reason.dependency.type,
                            userRequest: reason.dependency.userRequest
                        };
                        const dep = reason.dependency;
                        // todo: only NormalModule has templateModules but it's not Dependency, may be reason.module?
                        if (dep.templateModules) {
                            obj.templateModules = dep.templateModules.map(module => module.id);
                        }
                        if (typeof dep.loc === 'object') {
                            obj.loc = `${dep.loc.start.line}:${dep.loc.start.column}-${dep.loc.start.line !== dep.loc.end.line
                                ? dep.loc.end.line + ':'
                                : ''}${dep.loc.end.column}`;
                        }
                        return obj;
                    })
                    .sort((a, b) => a.moduleId - b.moduleId);
            }
            if (showUsedExports) {
                obj.usedExports = module.used ? module.usedExports : false;
            }
            if (showProvidedExports) {
                obj.providedExports = Array.isArray(module.providedExports) ? module.providedExports : null;
            }
            if (showSource && module._source) {
                obj.source = module._source.source();
            }
            return obj;
        }

        if (showChunks) {
            obj.chunks = compilation.chunks.map(chunk => {
                const obj: StatsChunk = {
                    id: chunk.id,
                    rendered: chunk.rendered,
                    initial: chunk.isInitial(),
                    entry: chunk.hasRuntime(),
                    recorded: chunk.recorded,
                    extraAsync: !!chunk.extraAsync,
                    size: chunk.modules.reduce((size, module) => size + module.size(), 0),
                    names: chunk.name ? [chunk.name] : [],
                    files: chunk.files.slice(),
                    hash: chunk.renderedHash,
                    parents: chunk.parents.map(c => c.id)
                };
                if (showChunkModules) {
                    obj.modules = chunk.modules.filter(moduleFilter).map(fnModule);
                    obj.filteredModules = chunk.modules.length - obj.modules.length;
                    obj.modules.sort(sortByField(sortModules));
                }
                if (showChunkOrigins) {
                    obj.origins = chunk.origins.map(origin => ({
                        moduleId: origin.module ? origin.module.id : undefined,
                        module: origin.module ? origin.module.identifier() : '',
                        moduleIdentifier: origin.module ? origin.module.identifier() : '',
                        moduleName: origin.module ? origin.module.readableIdentifier(requestShortener) : '',
                        loc: typeof origin.loc === 'object'
                            ? (
                                obj.loc = `${origin.loc.start.line}:${origin.loc.start.column}-${origin.loc.start.line !== origin.loc.end.line
                                    ? origin.loc.end.line + ':'
                                    : ''}${origin.loc.end.column}`)
                            : '',
                        name: origin.name,
                        reasons: origin.reasons || []
                    }));
                }
                return obj;
            });
            obj.chunks.sort(sortByField(sortChunks));
        }
        if (showModules) {
            obj.modules = compilation.modules.filter(moduleFilter).map(fnModule);
            obj.filteredModules = compilation.modules.length - obj.modules.length;
            obj.modules.sort(sortByField(sortModules));
        }
        if (showChildren) {
            obj.children = compilation.children.map(child => {
                const obj = new Stats(child).toJson(options, forToString);
                delete obj.hash;
                delete obj.version;
                obj.name = child.name;
                return obj;
            });
        }
        return obj;
    }

    toString(options?: StatsOptions | boolean | string) {
        if (typeof options === 'boolean' || typeof options === 'string') {
            options = Stats.presetToOptions(options);
        }
        else if (!options) {
            options = {} as StatsOptions;
        }

        function d(v: any, def: any) {
            return v === undefined ? def : v;
        }

        const useColors = d(options.colors, false);

        const obj = this.toJson(options, true);

        return Stats.jsonToString(obj, useColors);
    }

    static jsonToString(obj: StatsJson, useColors: boolean | Colors) {
        const buffer: string[] = [];

        const defaultColors = {
            bold: '\x1B[1m',
            yellow: '\x1B[1m\x1B[33m',
            red: '\x1B[1m\x1B[31m',
            green: '\x1B[1m\x1B[32m',
            cyan: '\x1B[1m\x1B[36m',
            magenta: '\x1B[1m\x1B[35m'
        };

        const colors = Object.keys(defaultColors)
            .reduce((obj, color) => {
                obj[color] = function (str: string) {
                    if (useColors) {
                        buffer.push(useColors === true || useColors[color] === undefined
                            ? defaultColors[color]
                            : useColors[color]);
                    }
                    buffer.push(str);
                    if (useColors) {
                        buffer.push('\x1B[39m\x1B[22m');
                    }
                };
                return obj;
            }, {
                normal(str: string) {
                    buffer.push(str);
                }
            }) as Colors;

        function coloredTime(time: number) {
            let times = [800, 400, 200, 100];
            if (obj.time) {
                times = [obj.time / 2, obj.time / 4, obj.time / 8, obj.time / 16];
            }
            if (time < times[3]) {
                colors.normal(`${time}ms`);
            }
            else if (time < times[2]) {
                colors.bold(`${time}ms`);
            }
            else if (time < times[1]) {
                colors.green(`${time}ms`);
            }
            else if (time < times[0]) {
                colors.yellow(`${time}ms`);
            }
            else {
                colors.red(`${time}ms`);
            }
        }

        function newline() {
            buffer.push('\n');
        }

        function getText(arr: any[], row: number, col: number) {
            return arr[row][col].value;
        }

        type TableItem = {
            value: string
            color: (str: string| number) => void
        }

        function table(array: TableItem[][], align: string, splitter = '  ') {
            let row;
            const rows = array.length;
            let col;
            const cols = array[0].length;
            const colSizes = new Array(cols);
            let value;
            for (col = 0; col < cols; col++) {
                colSizes[col] = 3;
            }
            for (row = 0; row < rows; row++) {
                for (col = 0; col < cols; col++) {
                    value = `${getText(array, row, col)}`;
                    if (value.length === 0) {
                        colSizes[col] = 0;
                    }
                    if (value.length > colSizes[col]) {
                        colSizes[col] = value.length;
                    }
                }
            }
            for (row = 0; row < rows; row++) {
                for (col = 0; col < cols; col++) {
                    const format = array[row][col].color;
                    value = `${getText(array, row, col)}`;
                    let l = value.length;
                    if (align[col] === 'l') {
                        format(value);
                    }
                    for (; l < colSizes[col] && col !== cols - 1; l++) {
                        colors.normal(' ');
                    }

                    if (align[col] === 'r') {
                        format(value);
                    }
                    if (col + 1 < cols && colSizes[col] !== 0) {
                        colors.normal(splitter);
                    }
                }
                newline();
            }
        }

        function getAssetColor(asset: StatsAsset, defaultColor: (str: string| number) => void) {
            if (asset.isOverSizeLimit) {
                return colors.yellow;
            }

            return defaultColor;
        }

        if (obj.hash) {
            colors.normal('Hash: ');
            colors.bold(obj.hash);
            newline();
        }
        if (obj.version) {
            colors.normal('Version: webpack ');
            colors.bold(obj.version);
            newline();
        }
        if (typeof obj.time === 'number') {
            colors.normal('Time: ');
            colors.bold(obj.time);
            colors.normal('ms');
            newline();
        }
        if (obj.publicPath) {
            colors.normal('PublicPath: ');
            colors.bold(obj.publicPath);
            newline();
        }
        if (obj.assets && obj.assets.length > 0) {
            const t = [
                [
                    {
                        value: 'Asset',
                        color: colors.bold
                    },
                    {
                        value: 'Size',
                        color: colors.bold
                    }
                    ,
                    {
                        value: 'Chunks',
                        color: colors.bold
                    },
                    {
                        value: '',
                        color: colors.bold
                    },
                    {
                        value: '',
                        color: colors.bold
                    },
                    {
                        value: 'Chunk Names',
                        color: colors.bold
                    }
                ]
            ];
            obj.assets.forEach(function (asset) {
                t.push([
                    {
                        value: asset.name,
                        color: getAssetColor(asset, colors.green)
                    }, {
                        value: formatSize(asset.size),
                        color: getAssetColor(asset, colors.normal)
                    }, {
                        value: asset.chunks.join(', '),
                        color: colors.bold
                    }, {
                        value: asset.emitted ? '[emitted]' : '',
                        color: colors.green
                    }, {
                        value: asset.isOverSizeLimit ? '[big]' : '',
                        color: getAssetColor(asset, colors.normal)
                    }, {
                        value: asset.chunkNames.join(', '),
                        color: colors.normal
                    }
                ]);
            });
            table(t, 'rrrlll');
        }
        if (obj.entrypoints) {
            Object.keys(obj.entrypoints).forEach(name => {
                const ep = obj.entrypoints[name];
                colors.normal('Entrypoint ');
                colors.bold(name);
                if (ep.isOverSizeLimit) {
                    colors.normal(' ');
                    colors.yellow('[big]');
                }
                colors.normal(' =');
                ep.assets.forEach(asset => {
                    colors.normal(' ');
                    colors.green(asset);
                });
                newline();
            });
        }

        const modulesByIdentifier = {};
        if (obj.modules) {
            obj.modules.forEach(module => {
                modulesByIdentifier[`$${module.identifier}`] = module;
            });
        }
        else if (obj.chunks) {
            obj.chunks.forEach(chunk => {
                if (chunk.modules) {
                    chunk.modules.forEach(module => {
                        modulesByIdentifier[`$${module.identifier}`] = module;
                    });
                }
            });
        }

        function processModuleAttributes(module: StatsModule) {
            colors.normal(' ');
            colors.normal(formatSize(module.size));
            if (module.chunks) {
                module.chunks.forEach(chunk => {
                    colors.normal(' {');
                    colors.yellow(chunk);
                    colors.normal('}');
                });
            }
            if (!module.cacheable) {
                colors.red(' [not cacheable]');
            }
            if (module.optional) {
                colors.yellow(' [optional]');
            }
            if (module.built) {
                colors.green(' [built]');
            }
            if (module.prefetched) {
                colors.magenta(' [prefetched]');
            }
            if (module.failed) {
                colors.red(' [failed]');
            }
            if (module.warnings) {
                colors.yellow(` [${module.warnings} warning${module.warnings === 1 ? '' : 's'}]`);
            }
            if (module.errors) {
                colors.red(` [${module.errors} error${module.errors === 1 ? '' : 's'}]`);
            }
        }

        function processModuleContent(module: StatsModule, prefix: string) {
            if (Array.isArray(module.providedExports)) {
                colors.normal(prefix);
                colors.cyan(`[exports: ${module.providedExports.join(', ')}]`);
                newline();
            }
            if (module.usedExports !== undefined) {
                if (module.usedExports !== true) {
                    colors.normal(prefix);
                    if (module.usedExports === false) {
                        colors.cyan('[no exports used]');
                    }
                    else {
                        colors.cyan(`[only some exports used: ${module.usedExports.join(', ')}]`);
                    }
                    newline();
                }
            }
            if (module.reasons) {
                module.reasons.forEach(reason => {
                    // todo: reason is ModuleReason but not Module, perhaps should be reason.module?
                    colors.normal(prefix);
                    colors.normal(reason.type);
                    colors.normal(' ');
                    colors.cyan(reason.userRequest);
                    // todo: dead code
                    if (reason.templateModules) {
                        colors.cyan(reason.templateModules.join(' '));
                    }
                    colors.normal(' [');
                    colors.normal(reason.moduleId);
                    colors.normal('] ');
                    colors.magenta(reason.module);
                    if (reason.loc) {
                        colors.normal(' ');
                        colors.normal(reason.loc);
                    }
                    newline();
                });
            }
            if (module.profile) {
                colors.normal(prefix);
                let sum = 0;
                const path: StatsModule[] = [];
                let current = module;
                // todo: as module is a StatsModule, current.issuer is a string, this loop is useless
                while (current.issuer) {
                    path.unshift(current = current.issuer);
                }
                path.forEach(module => {
                    colors.normal('[');
                    colors.normal(module.id);
                    colors.normal('] ');
                    if (module.profile) {
                        const time = (module.profile.factory || 0) + (module.profile.building || 0);
                        coloredTime(time);
                        sum += time;
                        colors.normal(' ');
                    }
                    colors.normal('->');
                });
                Object.keys(module.profile).forEach(key => {
                    colors.normal(` ${key}:`);
                    const time = module.profile[key];
                    coloredTime(time);
                    sum += time;
                });
                colors.normal(' = ');
                coloredTime(sum);
                newline();
            }
        }

        if (obj.chunks) {
            obj.chunks.forEach(chunk => {
                colors.normal('chunk ');
                if (chunk.id < 1000) {
                    colors.normal(' ');
                }
                if (chunk.id < 100) {
                    colors.normal(' ');
                }
                if (chunk.id < 10) {
                    colors.normal(' ');
                }
                colors.normal('{');
                colors.yellow(chunk.id);
                colors.normal('} ');
                colors.green(chunk.files.join(', '));
                if (chunk.names && chunk.names.length > 0) {
                    colors.normal(' (');
                    colors.normal(chunk.names.join(', '));
                    colors.normal(')');
                }
                colors.normal(' ');
                colors.normal(formatSize(chunk.size));
                chunk.parents.forEach(id => {
                    colors.normal(' {');
                    colors.yellow(id);
                    colors.normal('}');
                });
                if (chunk.entry) {
                    colors.yellow(' [entry]');
                }
                else if (chunk.initial) {
                    colors.yellow(' [initial]');
                }
                if (chunk.rendered) {
                    colors.green(' [rendered]');
                }
                if (chunk.recorded) {
                    colors.green(' [recorded]');
                }
                newline();
                if (chunk.origins) {
                    chunk.origins.forEach(origin => {
                        colors.normal('    > ');
                        if (origin.reasons && origin.reasons.length) {
                            colors.yellow(origin.reasons.join(' '));
                            colors.normal(' ');
                        }
                        if (origin.name) {
                            colors.normal(origin.name);
                            colors.normal(' ');
                        }
                        if (origin.module) {
                            colors.normal('[');
                            colors.normal(origin.moduleId);
                            colors.normal('] ');
                            const module = modulesByIdentifier[`$${origin.module}`];
                            if (module) {
                                colors.bold(module.name);
                                colors.normal(' ');
                            }
                            if (origin.loc) {
                                colors.normal(origin.loc);
                            }
                        }
                        newline();
                    });
                }
                if (chunk.modules) {
                    chunk.modules.forEach(module => {
                        colors.normal(' ');
                        if (module.id < 1000) {
                            colors.normal(' ');
                        }
                        if (module.id < 100) {
                            colors.normal(' ');
                        }
                        if (module.id < 10) {
                            colors.normal(' ');
                        }
                        colors.normal('[');
                        colors.normal(module.id);
                        colors.normal('] ');
                        colors.bold(module.name);
                        processModuleAttributes(module);
                        newline();
                        processModuleContent(module, '        ');
                    });
                    if (chunk.filteredModules > 0) {
                        colors.normal(`     + ${chunk.filteredModules} hidden modules`);
                        newline();
                    }
                }
            });
        }
        if (obj.modules) {
            obj.modules.forEach(module => {
                if (module.id < 1000) {
                    colors.normal(' ');
                }
                if (module.id < 100) {
                    colors.normal(' ');
                }
                if (module.id < 10) {
                    colors.normal(' ');
                }
                colors.normal('[');
                colors.normal(module.id);
                colors.normal('] ');
                colors.bold(module.name || module.identifier);
                processModuleAttributes(module);
                newline();
                processModuleContent(module, '       ');
            });
            if (obj.filteredModules > 0) {
                colors.normal(`    + ${obj.filteredModules} hidden modules`);
                newline();
            }
        }
        if (obj._showWarnings && obj.warnings) {
            obj.warnings.forEach(warning => {
                newline();
                colors.yellow(`WARNING in ${warning}`);
                newline();
            });
        }
        if (obj._showErrors && obj.errors) {
            obj.errors.forEach(error => {
                newline();
                colors.red(`ERROR in ${error}`);
                newline();
            });
        }
        if (obj.children) {
            obj.children.forEach(child => {
                if (child.name) {
                    colors.normal('Child ');
                    colors.bold(child.name);
                    colors.normal(':');
                }
                else {
                    colors.normal('Child');
                }
                newline();
                buffer.push('    ');
                buffer.push(Stats.jsonToString(child, useColors).replace(/\n/g, '\n    '));
                newline();
            });
        }
        if (obj.needAdditionalPass) {
            colors.yellow('Compilation needs an additional pass and will compile again.');
        }

        while (buffer[buffer.length - 1] === '\n') {
            buffer.pop()
        }

        return buffer.join('');
    }

    static presetToOptions(name: string | boolean) {
        // Accepted values: none, errors-only, minimal, normal, verbose
        // Any other falsy value will behave as 'none', truthy values as 'normal'
        const pn = typeof name === 'string' && name.toLowerCase() || name;
        if (pn === 'none' || !pn) {
            return {
                hash: false,
                version: false,
                timings: false,
                assets: false,
                entrypoints: false,
                chunks: false,
                modules: false,
                reasons: false,
                usedExports: false,
                providedExports: false,
                children: false,
                source: false,
                errors: false,
                errorDetails: false,
                warnings: false,
                publicPath: false
            };
        }
        else {
            return {
                hash: pn !== 'errors-only' && pn !== 'minimal',
                version: pn === 'verbose',
                timings: pn !== 'errors-only' && pn !== 'minimal',
                assets: pn === 'verbose',
                entrypoints: pn === 'verbose',
                chunks: pn !== 'errors-only',
                chunkModules: pn === 'verbose',
                // warnings: pn !== "errors-only",
                errorDetails: pn !== 'errors-only' && pn !== 'minimal',
                reasons: pn === 'verbose',
                usedExports: pn === 'verbose',
                providedExports: pn === 'verbose',
                colors: true
            };
        }
    }
}

export = Stats;
