/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
class FlagIncludedChunksPlugin {
    apply(compiler) {
        compiler.plugin('compilation', compilation => {
            compilation.plugin('optimize-chunk-ids', chunks => {
                chunks.forEach(chunkA => {
                    chunks.forEach(chunkB => {
                        if (chunkA === chunkB) {
                            return;
                        }
                        // is chunkB in chunkA?
                        if (chunkA.modules.length < chunkB.modules.length) {
                            return;
                        }
                        for (let i = 0; i < chunkB.modules.length; i++) {
                            if (!chunkA.modules.includes(chunkB.modules[i])) {
                                return;
                            }
                        }
                        chunkA.ids.push(chunkB.id);
                    });
                });
            });
        });
    }
}

export = FlagIncludedChunksPlugin;