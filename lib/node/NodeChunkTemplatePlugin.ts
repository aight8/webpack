/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import { ConcatSource } from 'webpack-sources'

class NodeChunkTemplatePlugin {
	apply(chunkTemplate) {
		chunkTemplate.plugin('render', function (modules, chunk) {
			const source = new ConcatSource();
			source.add(`exports.ids = ${JSON.stringify(chunk.ids)};\nexports.modules = `);
			source.add(modules);
			source.add(';');
			return source;
		});
		chunkTemplate.plugin('hash', function (hash) {
			hash.update('node');
			hash.update('3');
		});
	}
}

export = NodeChunkTemplatePlugin;
