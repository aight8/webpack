/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
export = function removeAndDo(collection, thing, action) {
	const idx = this[collection].indexOf(thing);
	if (idx >= 0) {
		this[collection].splice(idx, 1);
		thing[action](this);
		return true;
	}
	return false;
};
