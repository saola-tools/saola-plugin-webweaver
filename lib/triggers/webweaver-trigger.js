'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var debugx = debug('appWebweaver:trigger');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  self.start = function() {
    debugx.enabled && debugx(' - combine middlewares ...');
    return Promise.resolve(params.webweaverService.combine());
  };

  self.stop = function() {
    return Promise.resolve();
  };

  debugx.enabled && debugx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "webweaverTrigger",
  "type": "object",
  "properties": {
    "webweaverService": {
      "type": "object"
    }
  }
};

module.exports = Service;
