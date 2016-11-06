/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import NullDependency = require('./NullDependency');
import DepBlockHelpers = require('./DepBlockHelpers');

class Template {
    apply(dep, source, outputOptions, requestShortener) {
        source.replace(dep.range[0], dep.range[1], require('./WebpackMissingModule').module(dep.request));
    }
}

class UnsupportedDependency extends NullDependency {
    constructor(request, range) {
        super();
        this.request = request;
        this.range = range;
    }

    static Template = Template
}

export = UnsupportedDependency;