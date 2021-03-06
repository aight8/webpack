/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequireResolveDependency = require('./RequireResolveDependency');
import RequireResolveContextDependency = require('./RequireResolveContextDependency');
import RequireResolveHeaderDependency = require('./RequireResolveHeaderDependency');
import ContextDependencyHelpers = require('./ContextDependencyHelpers');
import Parser = require('../Parser')
import { CallExpression } from 'estree'
import { ModuleOptions } from '../../typings/webpack-types'
import BasicEvaluatedExpression = require('../BasicEvaluatedExpression')

class RequireResolveDependencyParserPlugin {
    constructor(public options: ModuleOptions) {
    }

    apply(parser: Parser) {
        const options = this.options;
        parser.plugin('call require.resolve', function (expr: CallExpression) {
            return this.applyPluginsBailResult('call require.resolve(Weak)', expr, false);
        });
        parser.plugin('call require.resolveWeak', function (expr: CallExpression) {
            return this.applyPluginsBailResult('call require.resolve(Weak)', expr, true);
        });
        parser.plugin('call require.resolve(Weak)', function (expr: CallExpression, weak: boolean) {
            if (expr.arguments.length !== 1) {
                return;
            }
            const param = this.evaluateExpression(expr.arguments[0]);
            let dep;
            if (param.isConditional()) {
                param.options.forEach((option) => {
                    const result = this.applyPluginsBailResult('call require.resolve(Weak):item', expr, option, weak);
                    if (result === undefined) {
                        this.applyPluginsBailResult('call require.resolve(Weak):context', expr, option, weak);
                    }
                });
                dep = new RequireResolveHeaderDependency(expr.callee.range);
                dep.loc = expr.loc;
                this.state.current.addDependency(dep);
                return true;
            }
            else {
                const result = this.applyPluginsBailResult('call require.resolve(Weak):item', expr, param, weak);
                if (result === undefined) {
                    this.applyPluginsBailResult('call require.resolve(Weak):context', expr, param, weak);
                }
                dep = new RequireResolveHeaderDependency(expr.callee.range);
                dep.loc = expr.loc;
                this.state.current.addDependency(dep);
                return true;
            }
        });
        parser.plugin('call require.resolve(Weak):item', function (
            expr: CallExpression,
            param: BasicEvaluatedExpression,
            weak: boolean
        ) {
            if (param.isString()) {
                const dep = new RequireResolveDependency(param.string, param.range);
                dep.loc = expr.loc;
                dep.optional = !!this.scope.inTry;
                dep.weak = weak;
                this.state.current.addDependency(dep);
                return true;
            }
        });
        parser.plugin('call require.resolve(Weak):context', function (
            expr: CallExpression,
            param: BasicEvaluatedExpression,
            weak: boolean
        ) {
            const dep = ContextDependencyHelpers.create(RequireResolveContextDependency, param.range, param, expr, options);
            if (!dep) {
                return;
            }
            dep.loc = expr.loc;
            dep.optional = !!this.scope.inTry;
            dep.weak = weak;
            this.state.current.addDependency(dep);
            return true;
        });
    }
}

export = RequireResolveDependencyParserPlugin;
