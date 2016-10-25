/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import AMDRequireItemDependency = require('./AMDRequireItemDependency');

import AMDRequireArrayDependency = require('./AMDRequireArrayDependency');
import AMDRequireContextDependency = require('./AMDRequireContextDependency');
import AMDRequireDependenciesBlock = require('./AMDRequireDependenciesBlock');
import UnsupportedDependency = require('./UnsupportedDependency');
import LocalModuleDependency = require('./LocalModuleDependency');
import ContextDependencyHelpers = require('./ContextDependencyHelpers');
import LocalModulesHelpers = require('./LocalModulesHelpers');
import ConstDependency = require('./ConstDependency');
import getFunctionExpression = require('./getFunctionExpression');
import UnsupportedFeatureWarning = require('../UnsupportedFeatureWarning');

class AMDRequireDependenciesBlockParserPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(parser) {
		const options = this.options;
		parser.plugin('call require', function (expr) {
			let param;
			let dep;
			let old;
			let result;
			switch (expr.arguments.length) {
				case 1:
					param = this.evaluateExpression(expr.arguments[0]);
					dep = new AMDRequireDependenciesBlock(expr, param.range, null, this.state.module, expr.loc);
					old = this.state.current;
					this.state.current = dep;
					this.inScope([], function () {
						result = this.applyPluginsBailResult('call require:amd:array', expr, param);
					}.bind(this));
					this.state.current = old;
					if (!result) {
						return;
					}
					this.state.current.addBlock(dep);
					return true;
				case 2:
					param = this.evaluateExpression(expr.arguments[0]);
					dep = new AMDRequireDependenciesBlock(expr, param.range, expr.arguments[1].range, this.state.module, expr.loc);
					dep.loc = expr.loc;
					old = this.state.current;
					this.state.current = dep;
					try {
						this.inScope([], function () {
							result = this.applyPluginsBailResult('call require:amd:array', expr, param);
						}.bind(this));
						if (!result) {
							dep = new UnsupportedDependency('unsupported', expr.range);
							old.addDependency(dep);
							if (this.state.module) {
								this.state.module.errors.push(new UnsupportedFeatureWarning(this.state.module, `Cannot statically analyse 'require(..., ...)' in line ${expr.loc.start.line}`));
							}
							dep = null;
							return true;
						}
						const fnData = getFunctionExpression(expr.arguments[1]);
						if (fnData) {
							this.inScope(fnData.fn.params.filter(function (i) {
								return !['require', 'module', 'exports'].includes(i.name);
							}), function () {
								if (fnData.fn.body.type === 'BlockStatement') {
									this.walkStatement(fnData.fn.body);
								}
								else {
									this.walkExpression(fnData.fn.body);
								}
							}.bind(this));
							this.walkExpressions(fnData.expressions);
							if (fnData.needThis === false) {
								// smaller bundles for simple function expression
								dep.bindThis = false;
							}
						}
						else {
							this.walkExpression(expr.arguments[1]);
						}
					} finally {
						this.state.current = old;
						if (dep) {
							this.state.current.addBlock(dep);
						}
					}
					return true;
			}
		});
		parser.plugin('call require:amd:array', function (expr, param) {
			if (param.isArray()) {
				param.items.forEach(function (param) {
					const result = this.applyPluginsBailResult('call require:amd:item', expr, param);
					if (result === undefined) {
						this.applyPluginsBailResult('call require:amd:context', expr, param);
					}
				}, this);
				return true;
			}
			else if (param.isConstArray()) {
				const deps = [];
				param.array.forEach(function (request) {
					let dep;
					let localModule;
					if (request === 'require') {
						dep = '__webpack_require__';
					}
					else if (['exports', 'module'].includes(request)) {
						dep = request;
					}
					else if (localModule = LocalModulesHelpers.getLocalModule(this.state, request)) {
						// eslint-disable-line no-cond-assign
						dep = new LocalModuleDependency(localModule);
						dep.loc = expr.loc;
						this.state.current.addDependency(dep);
					}
					else {
						dep = new AMDRequireItemDependency(request);
						dep.loc = expr.loc;
						dep.optional = !!this.scope.inTry;
						this.state.current.addDependency(dep);
					}
					deps.push(dep);
				}, this);
				const dep = new AMDRequireArrayDependency(deps, param.range);
				dep.loc = expr.loc;
				dep.optional = !!this.scope.inTry;
				this.state.current.addDependency(dep);
				return true;
			}
		});
		parser.plugin('call require:amd:item', function (expr, param) {
			if (param.isConditional()) {
				param.options.forEach(function (param) {
					const result = this.applyPluginsBailResult('call require:amd:item', expr, param);
					if (result === undefined) {
						this.applyPluginsBailResult('call require:amd:context', expr, param);
					}
				}, this);
				return true;
			}
			else if (param.isString()) {
				let dep;
				let localModule;
				if (param.string === 'require') {
					dep = new ConstDependency('__webpack_require__', param.string);
				}
				else if (['exports', 'module'].includes(param.string)) {
					dep = new ConstDependency(param.string, param.range);
				}
				else if (localModule = LocalModulesHelpers.getLocalModule(this.state, param.string)) {
					// eslint-disable-line no-cond-assign
					dep = new LocalModuleDependency(localModule, param.range);
				}
				else {
					dep = new AMDRequireItemDependency(param.string, param.range);
				}
				dep.loc = expr.loc;
				dep.optional = !!this.scope.inTry;
				this.state.current.addDependency(dep);
				return true;
			}
		});
		parser.plugin('call require:amd:context', function (expr, param) {
			const dep = ContextDependencyHelpers.create(AMDRequireContextDependency, param.range, param, expr, options);
			if (!dep) {
				return;
			}
			dep.loc = expr.loc;
			dep.optional = !!this.scope.inTry;
			this.state.current.addDependency(dep);
			return true;
		});
	}
}

export = AMDRequireDependenciesBlockParserPlugin;
