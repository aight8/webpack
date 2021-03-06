/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import WebpackMissingModule = require('./WebpackMissingModule')
import ModuleDependency = require('./ModuleDependency')
import { ReplaceSource } from 'webpack-sources'
import { WebpackOutputOptions } from '../../typings/webpack-types'
import RequestShortener = require('../RequestShortener')

class ModuleDependencyTemplateAsId {
    apply(
        dep: ModuleDependency,
        source: ReplaceSource,
        outputOptions: WebpackOutputOptions,
        requestShortener: RequestShortener
    ) {
        if (!dep.range) {
            return;
        }
        const comment = outputOptions.pathinfo ? `/*! ${requestShortener.shorten(dep.request)} */ ` : '';
        let content;
        if (dep.module) {
            content = comment + JSON.stringify(dep.module.id);
        }
        else {
            content = WebpackMissingModule.module(dep.request);
        }
        source.replace(dep.range[0], dep.range[1] - 1, content);
    }
}

export = ModuleDependencyTemplateAsId;
