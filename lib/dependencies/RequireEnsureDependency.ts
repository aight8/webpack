/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import NullDependency = require('./NullDependency');
import DepBlockHelpers = require('./DepBlockHelpers');
import { ReplaceSource } from 'webpack-sources'
import { WebpackOutputOptions } from '../../typings/webpack-types'
import RequestShortener = require('../RequestShortener')
import RequireEnsureDependenciesBlock = require('./RequireEnsureDependenciesBlock')

class Template {
    apply(
        dep: RequireEnsureDependency,
        source: ReplaceSource,
        outputOptions: WebpackOutputOptions,
        requestShortener: RequestShortener
    ) {
        const depBlock = dep.block;
        const wrapper = DepBlockHelpers.getLoadDepBlockWrapper(depBlock, outputOptions, requestShortener, 'require.ensure');
        const startBlock = `${wrapper[0]}(`;
        const endBlock = `).bind(null, __webpack_require__)${wrapper[1]}__webpack_require__.oe${wrapper[2]}`;
        source.replace(depBlock.expr.range[0], depBlock.expr.arguments[1].range[0] - 1, startBlock);
        source.replace(depBlock.expr.arguments[1].range[1], depBlock.expr.range[1] - 1, endBlock);
    }
}

class RequireEnsureDependency extends NullDependency {
    constructor(public block: RequireEnsureDependenciesBlock) {
        super();
    }

    get type() {
        return 'require.ensure';
    }

    static Template = Template
}

export = RequireEnsureDependency;
