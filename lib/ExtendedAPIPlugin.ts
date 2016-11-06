/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import ConstDependency = require('./dependencies/ConstDependency');
import BasicEvaluatedExpression = require('./BasicEvaluatedExpression');
import NullFactory = require('./NullFactory');

const REPLACEMENTS = {
    __webpack_hash__: '__webpack_require__.h' // eslint-disable-line camelcase
};
const REPLACEMENT_TYPES = {
    __webpack_hash__: 'string' // eslint-disable-line camelcase
};

class ExtendedAPIPlugin {
    apply(compiler) {
        compiler.plugin('compilation', (compilation, params) => {
            compilation.dependencyFactories.set(ConstDependency, new NullFactory());
            compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
            compilation.mainTemplate.plugin('require-extensions', function (source, chunk, hash) {
                const buf = [source];
                buf.push('');
                buf.push('// __webpack_hash__');
                buf.push(`${this.requireFn}.h = ${JSON.stringify(hash)};`);
                return this.asString(buf);
            });
            compilation.mainTemplate.plugin('global-hash', () => true);

            params.normalModuleFactory.plugin('parser', (parser, parserOptions) => {
                Object.keys(REPLACEMENTS).forEach(key => {
                    parser.plugin(`expression ${key}`, function (expr) {
                        const dep = new ConstDependency(REPLACEMENTS[key], expr.range);
                        dep.loc = expr.loc;
                        this.state.current.addDependency(dep);
                        return true;
                    });
                    parser.plugin(`evaluate typeof ${key}`, expr =>
                        new BasicEvaluatedExpression()
                            .setString(REPLACEMENT_TYPES[key])
                            .setRange(expr.range));
                });
            });
        });
    }
}

export = ExtendedAPIPlugin;