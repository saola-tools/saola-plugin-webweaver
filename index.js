'use strict';

const plugin = require('devebot').registerLayerware(__dirname, ['app-webserver']);

const builtinPackages = [
	'express',
	'express-session',
	'cookie-parser',
	'body-parser',
	'ejs'
];

plugin.require = function(packageName) {
	if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
	return null;
};

module.exports = plugin;