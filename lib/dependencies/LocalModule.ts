/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
class LocalModule {
    constructor(module, name, idx) {
        this.module = module;
        this.name = name;
        this.idx = idx;
        this.used = false;
    }

    flagUsed() {
        this.used = true;
    }

    variableName() {
        return `__WEBPACK_LOCAL_MODULE_${this.idx}__`;
    }
}

export = LocalModule;