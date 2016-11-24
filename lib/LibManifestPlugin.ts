/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import path = require('path');
import async = require('async');
import Compiler = require('./Compiler')
import Compilation = require('./Compilation')
import Chunk = require('./Chunk')
import NormalModule = require('./NormalModule')

class LibManifestPlugin {
    constructor(
        public options: {
            name: string
            path: string
            type: string
            context: string
        }
    ) {
    }

    apply(compiler: Compiler) {
        compiler.plugin('emit', (compilation: Compilation, callback) => {
            async.each(compilation.chunks, (chunk: Chunk, callback) => {
                if (!chunk.isInitial()) {
                    callback();
                    return;
                }
                const targetPath = compilation.getPath(this.options.path, {
                    hash: compilation.hash,
                    chunk
                });
                const name = this.options.name && compilation.getPath(this.options.name, {
                        hash: compilation.hash,
                        chunk
                    });
                const manifest = {
                    name,
                    type: this.options.type,
                    content: chunk.modules.reduce((obj, module: NormalModule) => {
                        if (module.libIdent) {
                            const ident = module.libIdent({
                                context: this.options.context || compiler.options.context
                            });
                            if (ident) {
                                obj[ident] = {
                                    id: module.id,
                                    meta: module.meta,
                                    exports: Array.isArray(module.providedExports) ? module.providedExports : undefined
                                };
                            }
                        }
                        return obj;
                    }, {})
                };
                const content = new Buffer(JSON.stringify(manifest, null, 2), 'utf-8');
                compiler.outputFileSystem.mkdirp(path.dirname(targetPath), err => {
                    if (err) {
                        return callback(err);
                    }
                    compiler.outputFileSystem.writeFile(targetPath, content, callback);
                });
            }, callback);
        });
    }
}

export = LibManifestPlugin;
