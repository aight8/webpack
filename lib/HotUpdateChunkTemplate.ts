/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import Template = require('./Template');

class HotUpdateChunkTemplate extends Template {
    constructor(outputOptions) {
        super(outputOptions);
    }

    render(id, modules, removedModules, hash, moduleTemplate, dependencyTemplates) {
        const modulesSource = this.renderChunkModules({
            id,
            modules,
            removedModules
        }, moduleTemplate, dependencyTemplates);
        const core = this.applyPluginsWaterfall('modules', modulesSource, modules, removedModules, moduleTemplate, dependencyTemplates);
        const source = this.applyPluginsWaterfall('render', core, modules, removedModules, hash, id, moduleTemplate, dependencyTemplates);
        return source;
    }

    updateHash(hash) {
        hash.update('HotUpdateChunkTemplate');
        hash.update('1');
        this.applyPlugins('hash', hash);
    }
}

export = HotUpdateChunkTemplate;