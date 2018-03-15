'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var pinbug = Devebot.require('pinbug');

var Service = function(params) {
  params = params || {};
  var self = this;

  var debugx = pinbug('app-webweaver:trigger');
  var crateID = chores.getBlockRef(__filename, 'app-webweaver');
  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ crateID, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  self.start = function() {
    LX.has('silly') && LX.log('silly', LT.add({
      crateID: crateID
    }).toMessage({
      tags: [ crateID, 'trigger-starting' ],
      text: ' - trigger[${crateID}] is starting'
    }));
    return Promise.resolve(params.webweaverService.combine());
  };

  self.stop = function() {
    LX.has('silly') && LX.log('silly', LT.add({
      crateID: crateID
    }).toMessage({
      tags: [ crateID, 'trigger-stopping' ],
      text: ' - trigger[${crateID}] is stopping'
    }));
    return Promise.resolve();
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ crateID, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.referenceList = [ "webweaverService" ];

module.exports = Service;
