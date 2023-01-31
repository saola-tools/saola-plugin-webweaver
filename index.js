"use strict";

const plugin = require("@saola/core").registerLayerware(__dirname, ["@saola/plugin-webserver"]);

const builtinPackages = [
  "express",
  "express-session",
  "cookie-parser",
  "body-parser",
  "ejs"
];

plugin.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  return null;
};

module.exports = plugin;
