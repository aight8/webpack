/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequireIncludeDependency = require('./RequireIncludeDependency');
import RequireIncludeDependencyParserPlugin = require('./RequireIncludeDependencyParserPlugin');
import ConstDependency = require('./ConstDependency');
import BasicEvaluatedExpression = require('../BasicEvaluatedExpression');

class RequireIncludePlugin {
    apply(compiler) {
        compiler.plugin('compilation', function (compilation, params) {
            const normalModuleFactory = params.normalModuleFactory;

            compilation.dependencyFactories.set(RequireIncludeDependency, normalModuleFactory);
            compilation.dependencyTemplates.set(RequireIncludeDependency, new RequireIncludeDependency.Template());

            params.normalModuleFactory.plugin('parser', function (parser, parserOptions) {

                if (typeof parserOptions.requireInclude !== 'undefined' && !parserOptions.requireInclude) {
                    return;
                }

                parser.apply(new RequireIncludeDependencyParserPlugin());
                parser.plugin('evaluate typeof require.include', function (expr) {
                    return new BasicEvaluatedExpression().setString('function').setRange(expr.range);
                });
                parser.plugin('typeof require.include', function (expr) {
                    const dep = new ConstDependency('\'function\'', expr.range);
                    dep.loc = expr.loc;
                    this.state.current.addDependency(dep);
                    return true;
                });
            });
        });
    }
}

export = RequireIncludePlugin;