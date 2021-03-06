/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import RequireEnsureDependenciesBlock = require('./RequireEnsureDependenciesBlock');
import RequireEnsureItemDependency = require('./RequireEnsureItemDependency');
import getFunctionExpression = require('./getFunctionExpression');
import { CallExpression, FunctionExpression } from 'estree'
import Parser = require('../Parser')

class RequireEnsureDependenciesBlockParserPlugin {
    apply(parser: Parser) {
        parser.plugin('call require.ensure', function (this: Parser, expr: CallExpression) {
            let chunkName = null;
            let chunkNameRange = null;
            switch (expr.arguments.length) {
                case 3:
                    const chunkNameExpr = this.evaluateExpression(expr.arguments[2]);
                    if (!chunkNameExpr.isString()) {
                        return;
                    }
                    chunkNameRange = chunkNameExpr.range;
                    chunkName = chunkNameExpr.string;
                // falls through
                case 2:
                    const dependenciesExpr = this.evaluateExpression(expr.arguments[0]);
                    const dependenciesItems = dependenciesExpr.isArray() ? dependenciesExpr.items : [dependenciesExpr];
                    const fnExpressionArg = expr.arguments[1] as FunctionExpression;
                    const fnExpression = getFunctionExpression(fnExpressionArg);

                    if (fnExpression) {
                        this.walkExpressions(fnExpression.expressions);
                    }

                    const dep = new RequireEnsureDependenciesBlock(
                        expr,
                        fnExpression ? fnExpression.fn : fnExpressionArg,
                        chunkName,
                        chunkNameRange,
                        this.state.module, expr.loc
                    );
                    const old = this.state.current;
                    this.state.current = dep;
                    try {
                        let failed = false;
                        this.inScope([], () => {
                            dependenciesItems.forEach(ee => {
                                if (ee.isString()) {
                                    const edep = new RequireEnsureItemDependency(ee.string);
                                    edep.loc = dep.loc;
                                    dep.addDependency(edep);
                                }
                                else {
                                    failed = true;
                                }
                            });
                        });
                        if (failed) {
                            return;
                        }
                        if (fnExpression) {
                            if (fnExpression.fn.body.type === 'BlockStatement') {
                                this.walkStatement(fnExpression.fn.body);
                            }
                            else {
                                this.walkExpression(fnExpression.fn.body);
                            }
                        }
                        old.addBlock(dep);
                    } finally {
                        this.state.current = old;
                    }
                    if (!fnExpression) {
                        this.walkExpression(fnExpressionArg);
                    }
                    return true;
            }
        })
    }

}

export = RequireEnsureDependenciesBlockParserPlugin
