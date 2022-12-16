"use strict";

const path = require("path");

const app = require("devebot").launchApplication({
  appRootPath: __dirname
}, [{
  name: "app-webweaver",
  path: path.join(__dirname, "index.js")
}]);

if (require.main === module) app.server.start();

module.exports = app;
