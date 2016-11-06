/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import WebpackMissingModule = require('./WebpackMissingModule')

class ContextDependencyTemplateAsId {
    apply(dep, source, outputOptions, requestShortener) {
        let comment = '';
        if (outputOptions.pathinfo) {
            comment = `/*! ${requestShortener.shorten(dep.request)} */ `;
        }
        if (dep.module && dep.module.dependencies && dep.module.dependencies.length > 0) {
            if (dep.valueRange) {
                source.replace(dep.valueRange[1], dep.range[1] - 1, ')');
                source.replace(
                    dep.range[0],
                    dep.valueRange[0] - 1,
                    `__webpack_require__(${comment}${JSON.stringify(dep.module.id)}).resolve(${
                        typeof dep.prepend === 'string' ? JSON.stringify(dep.prepend) : ''}`
                );
            }
            else {
                source.replace(dep.range[0], dep.range[1] - 1, `__webpack_require__(${comment}${JSON.stringify(dep.module.id)}).resolve`);
            }
        }
        else {
            const content = WebpackMissingModule.module(dep.request);
            source.replace(dep.range[0], dep.range[1] - 1, content);
        }
    }
}

export = ContextDependencyTemplateAsId;