/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
let nextIdent = 0;

class CommonsChunkPlugin {
    constructor(options) {
        if (arguments.length > 1) {
            throw new Error(`Deprecation notice: CommonsChunkPlugin now only takes a single argument. Either an options object *or* the name of the chunk.
Example: if your old code looked like this:
    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js')

You would change it to:
    new webpack.optimize.CommonsChunkPlugin({ name: 'vendor', filename: 'vendor.bundle.js' })

The available options are:
    name: string
    names: string[]
    filename: string
    minChunks: number
    async: boolean
    minSize: number
`);
        }
        if (Array.isArray(options) || typeof options === 'string') {
            options = {
                name: options
            };
        }
        this.chunkNames = options.name || options.names;
        this.filenameTemplate = options.filename;
        this.minChunks = options.minChunks;
        this.selectedChunks = options.chunks;
        if (options.children) {
            this.selectedChunks = false;
        }
        this.async = options.async;
        this.minSize = options.minSize;
        this.ident = __filename + nextIdent++;
    }

    apply(compiler) {
        const chunkNames = this.chunkNames;
        const filenameTemplate = this.filenameTemplate;
        const minChunks = this.minChunks;
        const selectedChunks = this.selectedChunks;
        const async = this.async;
        const minSize = this.minSize;
        const ident = this.ident;
        compiler.plugin('this-compilation', compilation => {
            compilation.plugin(['optimize-chunks', 'optimize-extracted-chunks'], function (chunks) {
                // only optimize once
                if (compilation[ident]) {
                    return;
                }
                compilation[ident] = true;

                let commonChunks;
                if (!chunkNames && (selectedChunks === false || async)) {
                    commonChunks = chunks;
                }
                else if (Array.isArray(chunkNames) || typeof chunkNames === 'string') {
                    commonChunks = [].concat(chunkNames).map(function (chunkName) {
                        let chunk = chunks.filter(chunk => chunk.name === chunkName)[0];
                        if (!chunk) {
                            chunk = this.addChunk(chunkName);
                        }
                        return chunk;
                    }, this);
                }
                else {
                    throw new Error('Invalid chunkNames argument');
                }
                commonChunks.forEach(function processCommonChunk(commonChunk, idx) {
                    let usedChunks;
                    if (Array.isArray(selectedChunks)) {
                        usedChunks = chunks.filter(chunk => {
                            if (chunk === commonChunk) {
                                return false;
                            }
                            return selectedChunks.includes(chunk.name);
                        });
                    }
                    else if (selectedChunks === false || async) {
                        usedChunks = (commonChunk.chunks || []).filter(chunk => // we can only move modules from this chunk if the "commonChunk" is the only parent
                        async || chunk.parents.length === 1);
                    }
                    else {
                        if (commonChunk.parents.length > 0) {
                            compilation.errors.push(new Error(`CommonsChunkPlugin: While running in normal mode it's not allowed to use a non-entry chunk (${commonChunk.name})`));
                            return;
                        }
                        usedChunks = chunks.filter(chunk => {
                            const found = commonChunks.indexOf(chunk);
                            if (found >= idx) {
                                return false;
                            }
                            return chunk.hasRuntime();
                        });
                    }
                    if (async) {
                        var asyncChunk = this.addChunk(typeof async === 'string' ? async : undefined);
                        asyncChunk.chunkReason = 'async commons chunk';
                        asyncChunk.extraAsync = true;
                        asyncChunk.addParent(commonChunk);
                        commonChunk.addChunk(asyncChunk);
                        commonChunk = asyncChunk;
                    }
                    const reallyUsedModules = [];
                    if (minChunks !== Infinity) {
                        const commonModulesCount = [];
                        const commonModules = [];
                        usedChunks.forEach(chunk => {
                            chunk.modules.forEach(module => {
                                const idx = commonModules.indexOf(module);
                                if (idx < 0) {
                                    commonModules.push(module);
                                    commonModulesCount.push(1);
                                }
                                else {
                                    commonModulesCount[idx]++;
                                }
                            });
                        });
                        const _minChunks = minChunks || Math.max(2, usedChunks.length);
                        commonModulesCount.forEach((count, idx) => {
                            const module = commonModules[idx];
                            if (typeof minChunks === 'function') {
                                if (!minChunks(module, count)) {
                                    return;
                                }
                            }
                            else if (count < _minChunks) {
                                return;
                            }
                            reallyUsedModules.push(module);
                        });
                    }
                    if (minSize) {
                        const size = reallyUsedModules.reduce((a, b) => a + b.size(), 0);
                        if (size < minSize) {
                            return;
                        }
                    }
                    const reallyUsedChunks = [];
                    reallyUsedModules.forEach(module => {
                        usedChunks.forEach(chunk => {
                            if (module.removeChunk(chunk)) {
                                if (!reallyUsedChunks.includes(chunk)) {
                                    reallyUsedChunks.push(chunk);
                                }
                            }
                        });
                        commonChunk.addModule(module);
                        module.addChunk(commonChunk);
                    });
                    if (async) {
                        reallyUsedChunks.forEach(chunk => {
                            if (chunk.isInitial()) {
                                return;
                            }
                            chunk.blocks.forEach(block => {
                                block.chunks.unshift(commonChunk);
                                commonChunk.addBlock(block);
                            });
                        });
                        asyncChunk.origins = reallyUsedChunks.map(chunk => chunk.origins.map(origin => {
                            const newOrigin = Object.create(origin);
                            newOrigin.reasons = (origin.reasons || []).slice();
                            newOrigin.reasons.push('async commons');
                            return newOrigin;
                        })).reduce((arr, a) => {
                            arr.push(...a);
                            return arr;
                        }, []);
                    }
                    else {
                        usedChunks.forEach(chunk => {
                            chunk.parents = [commonChunk];
                            chunk.entrypoints.forEach(ep => {
                                ep.insertChunk(commonChunk, chunk);
                            });
                            commonChunk.addChunk(chunk);
                        });
                    }
                    if (filenameTemplate) {
                        commonChunk.filenameTemplate = filenameTemplate;
                    }
                }, this);
                return true;
            });
        });
    }
}

export = CommonsChunkPlugin;