'use strict';

const path = require('path');
const signtrap = require('signtrap');

const app = require('devebot').launchApplication({
  appRootPath: __dirname
}, [{
  name: 'app-webweaver',
  path: path.join(__dirname, '../../../index.js')
}]);

if (require.main === module) {
  app.server.start().finally(function() {
    signtrap(function(signal, err) {
      app.server.stop().then(function() {
        process.exit(0);
      });
    });
  });
}

module.exports = app;
