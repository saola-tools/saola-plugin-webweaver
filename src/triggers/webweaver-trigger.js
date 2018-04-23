'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-webweaver';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  self.start = function() {
    LX.has('silly') && LX.log('silly', LT.add({
      blockRef: blockRef
    }).toMessage({
      tags: [ blockRef, 'trigger-starting' ],
      text: ' - trigger[${blockRef}] is starting'
    }));
    return Promise.resolve(params.webweaverService.combine());
  };

  self.stop = function() {
    LX.has('silly') && LX.log('silly', LT.add({
      blockRef: blockRef
    }).toMessage({
      tags: [ blockRef, 'trigger-stopping' ],
      text: ' - trigger[${blockRef}] is stopping'
    }));
    return Promise.resolve();
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.referenceList = [ "webweaverService" ];

module.exports = Service;
