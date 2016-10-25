/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
class Entrypoint {
	constructor(name) {
		this.name = name;
		this.chunks = [];
	}

	unshiftChunk(chunk) {
		this.chunks.unshift(chunk);
		chunk.entrypoints.push(this);
	}

	insertChunk(chunk, before) {
		const idx = this.chunks.indexOf(before);
		if (idx >= 0) {
			this.chunks.splice(idx, 0, chunk);
		}
		else {
			throw new Error('before chunk not found');
		}
		chunk.entrypoints.push(this);
	}
}

export = Entrypoint;
