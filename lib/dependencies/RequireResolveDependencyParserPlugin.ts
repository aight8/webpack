/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequireResolveDependency = require('./RequireResolveDependency');

import RequireResolveContextDependency = require('./RequireResolveContextDependency');
import RequireResolveHeaderDependency = require('./RequireResolveHeaderDependency');
import ContextDependencyHelpers = require('./ContextDependencyHelpers');

class RequireResolveDependencyParserPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(parser) {
		const options = this.options;
		parser.plugin('call require.resolve', function (expr) {
			return this.applyPluginsBailResult('call require.resolve(Weak)', expr, false);
		});
		parser.plugin('call require.resolveWeak', function (expr) {
			return this.applyPluginsBailResult('call require.resolve(Weak)', expr, true);
		});
		parser.plugin('call require.resolve(Weak)', function (expr, weak) {
			if (expr.arguments.length !== 1) {
				return;
			}
			const param = this.evaluateExpression(expr.arguments[0]);
			let dep;
			if (param.isConditional()) {
				param.options.forEach(function (option) {
					const result = this.applyPluginsBailResult('call require.resolve(Weak):item', expr, option, weak);
					if (result === undefined) {
						this.applyPluginsBailResult('call require.resolve(Weak):context', expr, option, weak);
					}
				}, this);
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
		parser.plugin('call require.resolve(Weak):item', function (expr, param, weak) {
			if (param.isString()) {
				const dep = new RequireResolveDependency(param.string, param.range);
				dep.loc = expr.loc;
				dep.optional = !!this.scope.inTry;
				dep.weak = weak;
				this.state.current.addDependency(dep);
				return true;
			}
		});
		parser.plugin('call require.resolve(Weak):context', function (expr, param, weak) {
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
