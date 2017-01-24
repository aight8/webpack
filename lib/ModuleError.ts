/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import Module = require('./Module')

class ModuleError extends Error {
    name: string
    message: string

    constructor(public module: Module, public  err: string) {
        super();
        if (Error.hasOwnProperty('captureStackTrace')) {
            Error.captureStackTrace(this, this.constructor);
        }
        // todo: some other class use string properties in prototype, but here is not
        this.name = 'ModuleError';
        this.message = err;
    }
}

export = ModuleError;
