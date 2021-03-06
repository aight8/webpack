/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequireEnsureItemDependency = require('./RequireEnsureItemDependency');
import RequireEnsureDependency = require('./RequireEnsureDependency');
import ConstDependency = require('./ConstDependency');
import NullFactory = require('../NullFactory');
import RequireEnsureDependenciesBlockParserPlugin = require('./RequireEnsureDependenciesBlockParserPlugin');
import Compiler = require('../Compiler')
import Compilation = require('../Compilation')
import Parser = require('../Parser')
import { CompilationParams, ParserOptions } from '../../typings/webpack-types'
import ParserHelpers = require('../ParserHelpers');

class RequireEnsurePlugin {
    apply(compiler: Compiler) {
        compiler.plugin('compilation', function (compilation: Compilation, params: CompilationParams) {
            const normalModuleFactory = params.normalModuleFactory;

            compilation.dependencyFactories.set(RequireEnsureItemDependency, normalModuleFactory);
            compilation.dependencyTemplates.set(RequireEnsureItemDependency, new RequireEnsureItemDependency.Template());

            compilation.dependencyFactories.set(RequireEnsureDependency, new NullFactory());
            compilation.dependencyTemplates.set(RequireEnsureDependency, new RequireEnsureDependency.Template());

            params.normalModuleFactory.plugin('parser', function (parser: Parser, parserOptions: ParserOptions) {
                if (typeof parserOptions.requireEnsure !== 'undefined' && !parserOptions.requireEnsure) {
                    return;
                }

                parser.apply(new RequireEnsureDependenciesBlockParserPlugin());
                parser.plugin('evaluate typeof require.ensure', ParserHelpers.evaluateToString('function'));
                parser.plugin('typeof require.ensure', ParserHelpers.toConstantDependency(JSON.stringify('function')));

            });
        });
    }
}

export = RequireEnsurePlugin;
