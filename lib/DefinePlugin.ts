/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import ConstDependency = require('./dependencies/ConstDependency');
import BasicEvaluatedExpression = require('./BasicEvaluatedExpression');
import NullFactory = require('./NullFactory');
import Compiler = require('./Compiler')
import Compilation = require('./Compilation')
import Parser = require('./Parser')
import { CompilationParams, PlainObject } from '../typings/webpack-types'
import ParserHelpers = require("./ParserHelpers");

class DefinePlugin {
    constructor(public definitions: PlainObject) {
    }

    apply(compiler: Compiler) {
        const definitions = this.definitions;
        compiler.plugin('compilation', function (compilation: Compilation, params: CompilationParams) {
            compilation.dependencyFactories.set(ConstDependency, new NullFactory());
            compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());

            params.normalModuleFactory.plugin('parser', function (parser: Parser) {
                (function walkDefinitions(definitions, prefix) {
                    Object.keys(definitions).forEach(key => {
                        const code = definitions[key];
                        if (code && typeof code === 'object' && !(code instanceof RegExp)) {
                            walkDefinitions(code, `${prefix + key}.`);
                            applyObjectDefine(prefix + key, code);
                            return;
                        }
                        applyDefineKey(prefix, key);
                        applyDefine(prefix + key, code);
                    });
                })(definitions, '');

                function stringifyObj(obj: PlainObject): string {
                    return `{${Object.keys(obj).map(key => {
                        const code = obj[key];
                        return JSON.stringify(key) + ':' + toCode(code);
                    }).join(',')}}`;
                }

                function toCode(code: any): string {
                    if (code === null) {
                        return 'null';
                    }
                    else if (code === undefined) {
                        return 'undefined';
                    }
                    else if (code instanceof RegExp && code.toString) {
                        return code.toString();
                    }
                    else if (typeof code === 'function' && code.toString) {
                        return `(${code.toString()})`;
                    }
                    else if (typeof code === 'object') {
                        return stringifyObj(code);
                    }
                    else {
                        return `${code}`;
                    }
                }

                function applyDefineKey(prefix: string, key: string) {
                    const splittedKey = key.split('.');
                    splittedKey.slice(1).forEach((_, i) => {
                        const fullKey = prefix + splittedKey.slice(0, i + 1).join('.');
                        parser.plugin(`can-rename ${fullKey}`, () => true);
                    });
                }

                function applyDefine(key: string, code: any) {
                    const isTypeof = /^typeof\s+/.test(key);
                    if (isTypeof) {
                        key = key.replace(/^typeof\s+/, '');
                    }
                    let recurse = false;
                    let recurseTypeof = false;
                    code = toCode(code);
                    if (!isTypeof) {
                        parser.plugin(`can-rename ${key}`, () => true);
                        parser.plugin(`evaluate Identifier ${key}`, function (expr) {
                            if (recurse) {
                                return;
                            }
                            recurse = true;
                            const res = this.evaluate(code);
                            recurse = false;
                            res.setRange(expr.range);
                            return res;
                        });
                        parser.plugin(`expression ${key}`, function (expr) {
                            const dep = new ConstDependency(code, expr.range);
                            dep.loc = expr.loc;
                            this.state.current.addDependency(dep);
                            return true;
                        });
                    }
                    const typeofCode = isTypeof ? code : `typeof (${code})`;
                    parser.plugin(`evaluate typeof ${key}`, function (expr) {
                        if (recurseTypeof) {
                            return;
                        }
                        recurseTypeof = true;
                        const res = this.evaluate(typeofCode);
                        recurseTypeof = false;
                        res.setRange(expr.range);
                        return res;
                    });
                    parser.plugin(`typeof ${key}`, function (expr) {
                        const res = this.evaluate(typeofCode);
                        if (!res.isString()) {
                            return;
                        }
                        const dep = new ConstDependency(JSON.stringify(res.string), expr.range);
                        dep.loc = expr.loc;
                        this.state.current.addDependency(dep);
                        return true;
                    });
                }

                function applyObjectDefine(key: string, obj: PlainObject) {
                    const code = stringifyObj(obj);
                    parser.plugin(`can-rename ${key}`, () => true);
                    parser.plugin(`evaluate Identifier ${key}`,
                        expr => new BasicEvaluatedExpression().setRange(expr.range));
                    parser.plugin(`evaluate typeof ${key}`, ParserHelpers.evaluateToString("object"));
                    parser.plugin(`expression ${key}`, function (expr) {
                        const dep = new ConstDependency(code, expr.range);
                        dep.loc = expr.loc;
                        this.state.current.addDependency(dep);
                        return true;
                    });
                    parser.plugin(`typeof ${key}`, function (expr) {
                        const dep = new ConstDependency('"object"', expr.range);
                        dep.loc = expr.loc;
                        this.state.current.addDependency(dep);
                        return true;
                    });
                }
            });
        });
    }
}

export = DefinePlugin;
