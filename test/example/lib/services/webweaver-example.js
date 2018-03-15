'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var loader = Devebot.require('loader');
var pinbug = Devebot.require('pinbug');

var Service = function(params) {
  var debugx = pinbug('app-webweaver:example');
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};
  var self = this;

  var express = params.webweaverService.express;
  var appConfig = params.sandboxConfig;
  debugx.enabled && debugx('configuration: %s', JSON.stringify(appConfig));

  var getLayer1 = function(branches) {
    return {
      name: 'app1',
      path: ['*'],
      middleware: function(req, res, next) {
        process.nextTick(function() {
          debugx('=@ example receives a new request:');
          debugx(' - Invoker IP: %s / %s', req.ip, JSON.stringify(req.ips));
          debugx(' - protocol: ' + req.protocol);
          debugx(' - host: ' + req.hostname);
          debugx(' - path: ' + req.path);
          debugx(' - URL: ' + req.url);
          debugx(' - originalUrl: ' + req.originalUrl);
          debugx(' - body: ' + JSON.stringify(req.body));
          debugx(' - user-agent: ' + req.headers['user-agent']);
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

  if (appConfig.enabled !== false) {
    params.webweaverService.push([
      params.webweaverService.getDefaultRedirectLayer(),
      getLayer1([
        params.webweaverService.getSessionLayer([
          getLayer2()
        ])
      ])
    ], 500);
  }

  debugx.enabled && debugx(' - constructor end!');
};

Service.referenceList = [ "webweaverService" ];

module.exports = Service;
