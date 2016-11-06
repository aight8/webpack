/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
export function getLoadDepBlockWrapper(depBlock, outputOptions, requestShortener, name) {
    const promiseCode = getDepBlockPromise(depBlock, outputOptions, requestShortener, name);
    return [`${promiseCode}.catch(function(err) { __webpack_require__.oe(err); }).then(`, ')'];
}

export function getDepBlockPromise(depBlock, outputOptions, requestShortener, name) {
    if (depBlock.chunks) {
        const chunks = depBlock.chunks.filter(chunk => !chunk.hasRuntime() && typeof chunk.id === 'number');
        if (chunks.length === 1) {
            const chunk = chunks[0];
            return `__webpack_require__.e${asComment(name)}(${chunk.id}${
                outputOptions.pathinfo && depBlock.chunkName
                    ? `/*! ${requestShortener.shorten(depBlock.chunkName)} */`
                    : ''
                }${asComment(depBlock.chunkReason)})`;
        }
        else if (chunks.length > 0) {
            return `Promise.all${asComment(name)}(${outputOptions.pathinfo && depBlock.chunkName
                ? '/*! ' + requestShortener.shorten(depBlock.chunkName) + ' */'
                : ''}[${chunks.map(chunk => '__webpack_require__.e(' + chunk.id + ')').join(', ')}])`;
        }
    }
    return 'Promise.resolve()';
}

function asComment(str) {
    if (!str) {
        return '';
    }
    return `/* ${str} */`;
}