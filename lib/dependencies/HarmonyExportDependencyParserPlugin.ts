/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import HarmonyExportExpressionDependency = require('./HarmonyExportExpressionDependency');
import HarmonyExportHeaderDependency = require('./HarmonyExportHeaderDependency');
import HarmonyExportSpecifierDependency = require('./HarmonyExportSpecifierDependency');
import HarmonyExportImportedSpecifierDependency = require('./HarmonyExportImportedSpecifierDependency');
import HarmonyImportDependency = require('./HarmonyImportDependency');
import HarmonyModulesHelpers = require('./HarmonyModulesHelpers');
import { ExportDefaultDeclaration, ExportNamedDeclaration, Expression, Node, Statement } from 'estree'
import Parser = require('../Parser')

class HarmonyExportDependencyParserPlugin {
    apply(parser: Parser) {
        parser.plugin('export', function (this: Parser, statement: ExportNamedDeclaration | ExportDefaultDeclaration) {
            const dep = new HarmonyExportHeaderDependency(statement.declaration && statement.declaration.range, statement.range);
            dep.loc = Object.create(statement.loc);
            dep.loc.index = -1;
            this.state.current.addDependency(dep);
            return true;
        })

        parser.plugin('export import', function (this: Parser, statement: Statement, source: string) {
            const dep = new HarmonyImportDependency(source, HarmonyModulesHelpers.getNewModuleVar(this.state, source), statement.range);
            dep.loc = Object.create(statement.loc);
            dep.loc.index = -1;
            this.state.current.addDependency(dep);
            // todo: typo
            this.state.lastHarmoryImport = dep;
            return true;
        })

        parser.plugin('export expression', function (this: Parser, statement: Statement, expr: Expression) {
            const dep = new HarmonyExportExpressionDependency(this.state.module, expr.range, statement.range);
            dep.loc = Object.create(statement.loc);
            dep.loc.index = -1;
            this.state.current.addDependency(dep);
            return true;
        })

        parser.plugin('export declaration', statement => {})

        parser.plugin('export specifier', function (this: Parser,
                                                    statement: ExportDefaultDeclaration | ExportNamedDeclaration,
                                                    id: number,
                                                    name: string, idx: number
        ) {
            const rename = this.scope.renames[`$${id}`];
            let dep;
            if (rename === 'imported var') {
                const settings = this.state.harmonySpecifier[`$${id}`];
                dep = new HarmonyExportImportedSpecifierDependency(this.state.module, settings[0], settings[1], settings[2], name);
            }
            else {
                const immutable = statement.declaration && isImmutableStatement(statement.declaration);
                const hoisted = statement.declaration && isHoistedStatement(statement.declaration);
                dep = new HarmonyExportSpecifierDependency(this.state.module, id, name, !immutable || hoisted
                    ? -0.5
                    : statement.range[1] + 0.5, immutable);
            }
            dep.loc = Object.create(statement.loc);
            dep.loc.index = idx;
            this.state.current.addDependency(dep);
            return true;
        })

        parser.plugin('export import specifier', function (this: Parser, statement: Statement, source: string,
                                                           id: string, name: string, idx: number
        ) {
            // todo: here has typo
            const dep = new HarmonyExportImportedSpecifierDependency(this.state.module, this.state.lastHarmoryImport, HarmonyModulesHelpers.getModuleVar(this.state, source), id, name);
            dep.loc = Object.create(statement.loc);
            dep.loc.index = idx;
            this.state.current.addDependency(dep);
            return true;
        })
    }

}

export = HarmonyExportDependencyParserPlugin;

function isImmutableStatement(statement: Node) {
    if (statement.type === 'FunctionDeclaration') {
        return true;
    }
    if (statement.type === 'ClassDeclaration') {
        return true;
    }
    if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
        return true;
    }
    return false;
}

function isHoistedStatement(statement: Node) {
    if (statement.type === 'FunctionDeclaration') {
        return true;
    }
    return false;
}
