'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var loader = Devebot.require('loader');
var debug = Devebot.require('debug');
var debuglog = debug('appWebweaver:example');
var express = require('express');

var Service = function(params) {
  debuglog.isEnabled && debuglog(' + constructor begin ...');

  params = params || {};

  var self = this;

  var logger = self.logger = params.loggingFactory.getLogger();

  var pluginCfg = lodash.get(params, ['sandboxConfig', 'plugins', 'appWebweaver'], {});
  debuglog.isEnabled && debuglog('configuration: %s', JSON.stringify(pluginCfg));

  var getLayer1 = function(branches) {
    return {
      name: 'app1',
      path: ['*'],
      middleware: function(req, res, next) {
        process.nextTick(function() {
          debuglog('=@ example receives a new request:');
          debuglog(' - Invoker IP: %s / %s', req.ip, JSON.stringify(req.ips));
          debuglog(' - protocol: ' + req.protocol);
          debuglog(' - host: ' + req.hostname);
          debuglog(' - path: ' + req.path);
          debuglog(' - URL: ' + req.url);
          debuglog(' - originalUrl: ' + req.originalUrl);
          debuglog(' - body: ' + JSON.stringify(req.body));
          debuglog(' - user-agent: ' + req.headers['user-agent']);
        });
        next();
      },
      branches: branches
    }
  }

  var getLayer2 = function(branches) {
    return {
      name: 'app2',
      middleware: (function() {
        var app2 = express();
        app2.get('/example/:id', function(req, res) {
          res.status(200).json({
            message: 'example [' + req.params.id + '] request successfully'
          });
        });
        return app2;
      })(),
      branches: branches
    }
  }

  if (pluginCfg.enabled !== false) {
    params.webweaverService.build([
      getLayer1([
        params.webweaverService.getDefaultRedirectLayer(null, '/example/123'),
        getLayer2()
      ])
    ]);
  }

  debuglog.isEnabled && debuglog(' - constructor end!');
};

Service.argumentSchema = {
  "id": "exampleService",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "webweaverService": {
      "type": "object"
    }
  }
};

module.exports = Service;
