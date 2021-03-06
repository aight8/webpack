/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import { SourceLocation } from 'estree'

export = function compareLocations(
    a: string | SourceLocation & { index?: number },
    b: string | SourceLocation & { index?: number }
) {
    if (typeof a === 'string') {
        if (typeof b === 'string') {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        }
        else if (typeof b === 'object') {
            return 1;
        }
        else {
            return 0;
        }
    }
    else if (typeof a === 'object') {
        if (typeof b === 'string') {
            return -1;
        }
        else if (typeof b === 'object') {
            if (a.start && b.start) {
                const ap = a.start;
                const bp = b.start;
                if (ap.line < bp.line) return -1;
                if (ap.line > bp.line) return 1;
                if (ap.column < bp.column) return -1;
                if (ap.column > bp.column) return 1;
            }
            if (a.index < b.index) return -1;
            if (a.index > b.index) return 1;
            return 0;
        }
        else {
            return 0;
        }
    }
};
