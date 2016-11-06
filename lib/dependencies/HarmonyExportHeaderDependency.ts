/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import NullDependency = require('./NullDependency');

class Template {
    apply(dep, source, outputOptions, requestShortener) {
        let content;
        content = '';
        source.replace(dep.rangeStatement[0], dep.range ? dep.range[0] - 1 : dep.rangeStatement[1] - 1, content);
    }
}

class HarmonyExportHeaderDependency extends NullDependency {
    constructor(range, rangeStatement) {
        super();
        this.range = range;
        this.rangeStatement = rangeStatement;
    }

    static Template = Template
}

HarmonyExportHeaderDependency.prototype.type = 'harmony export header';

export = HarmonyExportHeaderDependency;