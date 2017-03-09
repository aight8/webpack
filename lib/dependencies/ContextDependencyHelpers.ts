/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import { Expression } from 'estree'
import { ModuleOptions, SourceRange } from '../../typings/webpack-types'
import BasicEvaluatedExpression = require('../BasicEvaluatedExpression')
import ContextDependency = require('./ContextDependency')

/**
 * Escapes regular expression metacharacters
 * @param {string} str String to quote
 * @return {string} Escaped string
 */
function quotemeta(str: string) {
    return str.replace(/[-[\]\\/{}()*+?.^$|]/g, '\\$&')
}

export function create<T extends ContextDependency>(
    Dep: {
        new(request: string, recursive: boolean, regExp: RegExp, range: SourceRange, valueRange: SourceRange): T;
    },
    range: SourceRange,
    param: BasicEvaluatedExpression,
    expr: Expression,
    options: ModuleOptions
): T {
    let dep;
    let prefix;
    let postfix;
    let prefixRange: SourceRange;
    let valueRange: SourceRange;
    let idx;
    let context;
    let regExp;
    if (param.isTemplateString()) {
        prefix = param.quasis[0].string;
        postfix = param.quasis.length > 1 ? param.quasis[param.quasis.length - 1].string : '';
        prefixRange = [param.quasis[0].range[0], param.quasis[0].range[1]];
        valueRange = param.range;
        idx = prefix.lastIndexOf('/');
        context = '.';
        if (idx >= 0) {
            context = prefix.substr(0, idx);
            prefix = `.${prefix.substr(idx)}`;
        }
        // If there are more than two quasis, maybe the generated RegExp can be more precise?
        regExp = new RegExp(`^${quotemeta(prefix)}${options.wrappedContextRegExp.source}${quotemeta(postfix)}$`);
        dep = new Dep(context, options.wrappedContextRecursive, regExp, range, valueRange);
        dep.loc = expr.loc;
        dep.replaces = [
            {
                range: prefixRange,
                value: prefix
            }
        ];
        dep.critical = options.wrappedContextCritical && 'a part of the request of a dependency is an expression';
        return dep;
    }
    else if (param.isWrapped() && (param.prefix && param.prefix.isString() || param.postfix && param.postfix.isString())) {
        prefix = param.prefix && param.prefix.isString() ? param.prefix.string : '';
        postfix = param.postfix && param.postfix.isString() ? param.postfix.string : '';
        prefixRange = param.prefix && param.prefix.isString() ? param.prefix.range : null;
        valueRange = [prefixRange ? prefixRange[1] : param.range[0], param.range[1]];
        idx = prefix.lastIndexOf('/');
        context = '.';
        if (idx >= 0) {
            context = prefix.substr(0, idx);
            prefix = `.${prefix.substr(idx)}`;
        }
        regExp = new RegExp(`^${quotemeta(prefix)}${options.wrappedContextRegExp.source}${quotemeta(postfix)}$`);
        dep = new Dep(context, options.wrappedContextRecursive, regExp, range, valueRange);
        dep.loc = expr.loc;
        dep.prepend = param.prefix && param.prefix.isString() ? prefix : null;
        dep.critical = options.wrappedContextCritical && 'a part of the request of a dependency is an expression';
        return dep;
    }
    else {
        dep = new Dep(options.exprContextRequest, options.exprContextRecursive, options.exprContextRegExp, range, param.range);
        dep.loc = expr.loc;
        dep.critical = options.exprContextCritical && 'the request of a dependency is an expression';
        return dep;
    }
}