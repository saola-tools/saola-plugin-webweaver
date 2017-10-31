'use strict';

var events = require('events');
var util = require('util');
var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var debugx = debug('appWebweaver:service');

var express = require('express');
var session = require('express-session');
var fileStore = require('session-file-store')(session);
var mongoStore = require('connect-mongo')(session);
var redisStore = require('connect-redis')(session);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  self.logger = params.loggingFactory.getLogger();

  var webweaverConfig = lodash.get(params, ['sandboxConfig', 'plugins', 'appWebweaver'], {});

  var apporo = express();

  Object.defineProperty(self, 'outlet', {
    get: function() { return apporo },
    set: function(value) {}
  });

  params.webserverTrigger.attach(apporo);

  //---------------------------------------------------------------------------

  self.getPrintRequestInfoLayer = function(branches, path) {
    return {
      skipped: !webweaverConfig.printRequestInfo,
      name: 'printRequestInfo',
      path: path,
      middleware: function(req, res, next) {
        process.nextTick(function() {
          debugx('=@ webserver receives a new request:');
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

  self.getUrlSslProtectionLayer = function(branches, sslProtectedUrls) {
    var sslUrls = sslProtectedUrls || webweaverConfig.sslProtectedUrls || [];
    return {
      name: 'urlProtectionBySSL',
      path: sslUrls,
      middleware: function(req, res, next) {
        if (req.client.authorized) {
          next();
          debugx.enabled && debugx(" - Passed Client: %s", req.originalUrl);
        } else {
          res.json({"status":"Access denied"}, 401);
          debugx.enabled && debugx(" - Denied client: %s", req.originalUrl);
        }
      },
      branches: branches
    }
  }

  self.getCacheControlLayer = function(branches, path) {
    var cacheControlConfig = lodash.get(webweaverConfig, ['cacheControl'], {});
    return {
      name: 'cacheControl',
      path: path,
      middleware: function(req, res, next) {
        if (cacheControlConfig.pattern && cacheControlConfig.pattern.url &&
            req.url.match(cacheControlConfig.pattern.url)) {
          res.setHeader('Cache-Control', 'public, max-age=' + cacheControlConfig.maxAge);
        }
        next();
      },
      branches: branches
    }
  }


  var sessionId = lodash.get(webweaverConfig, 'session.name', 'sessionId');
  var sessionSecret = lodash.get(webweaverConfig, 'session.secret', 's3cur3s3ss10n');

  self.getSessionLayer = function(branches, path) {
    var sessionOpts = {
      resave: true,
      saveUninitialized: true,
      name: sessionId,
      secret: sessionSecret
    };

    var sessionStoreDef = lodash.get(webweaverConfig, ['session', 'store'], {});
    debugx.enabled && debugx(' - session store: %s', JSON.stringify(sessionStoreDef));

    switch(sessionStoreDef.type) {
      case 'file':
        sessionOpts.store = new fileStore({
          path: sessionStoreDef.path
        });
        debugx.enabled && debugx(' - session.store ~ fileStore');
        break;
      case 'redis':
        sessionOpts.store = new redisStore({
          url: sessionStoreDef.url
        });
        debugx.enabled && debugx(' - session.store ~ redisStore');
        break;
      case 'mongodb':
        sessionOpts.store = new mongoStore({
          url: sessionStoreDef.url
        });
        debugx.enabled && debugx(' - session.store ~ mongoStore');
        break;
      default:
        debugx.enabled && debugx(' - session.store ~ MemoryStore (default)');
    }

    return {
      name: 'session',
      path: path,
      middleware: session(sessionOpts),
      branches: branches
    }
  }

  self.getCookieParserLayer = function(branches, path) {
    return {
      name: 'cookieParser',
      path: path,
      middleware: cookieParser(sessionSecret),
      branches: branches
    }
  }

  self.getJsonBodyParserLayer = function(branches, path) {
    return {
      name: 'bodyParser.json',
      path: path,
      middleware: bodyParser.json({ limit: webweaverConfig.jsonBodySizeLimit || '2mb' }),
      branches: branches
    }
  }

  self.getUrlencodedBodyParserLayer = function(branches, path) {
    return {
      name: 'bodyParser.urlencoded',
      path: path,
      middleware: bodyParser.urlencoded({ extended: true }),
      branches: branches
    }
  }

  self.getCompressionLayer = function(branches, path) {
    return {
      name: 'compression',
      path: path,
      middleware: require('compression')(),
      branches: branches
    }
  }

  self.getCsrfLayer = function(branches, path) {
    return {
      name: 'csurf',
      path: path,
      middleware: require('csurf')({ cookie: { signed: true } }),
      branches: branches
    }
  }

  self.getHelmetLayer = function(branches, path) {
    return {
      name: 'helmet',
      path: path,
      middleware: require('helmet')(),
      branches: branches
    }
  }

  self.getMethodOverrideLayer = function(branches, path) {
    return {
      name: 'methodOverride',
      path: path,
      middleware: require('method-override')(),
      branches: branches
    }
  }

  self.getChangePowerByLayer = function(branches, path) {
    var middleware = null;
    if (webweaverConfig.setPoweredBy) {
      middleware = function setPoweredBy(req, res, next) {
        res.setHeader('X-Powered-By', webweaverConfig.setPoweredBy);
        next();
      };
    } else {
      middleware = function hidePoweredBy(req, res, next) {
        res.removeHeader('X-Powered-By');
        next();
      };
    }
    return {
      name: 'changePowerBy',
      path: path,
      middleware: middleware,
      branches: branches
    }
  }

  self.getDefaultRedirectLayer = function() {
    return {
      skipped: lodash.isEmpty(webweaverConfig.defaultRedirectUrl),
      name: 'defaultRedirect',
      path: ['/$'],
      middleware: function defaultRedirect(req, res, next) {
        res.redirect(webweaverConfig.defaultRedirectUrl);
      }
    }
  }

  //---------------------------------------------------------------------------

  var buildMiddlewares = function(layers) {
    var rack = express();
    lodash.forEach(layers, function(layer) {
      if (layer.enabled !== false) {
        if (layer.skipped !== true && lodash.isFunction(layer.middleware)) {
          if (layer.path) {
            if (!(lodash.isArray(layer.path) && lodash.isEmpty(layer.path))) {
              rack.use(layer.path, layer.middleware);
            }
          } else {
            rack.use(layer.middleware);
          }
        }
        if (lodash.isArray(layer.branches) && !lodash.isEmpty(layer.branches)) {
          rack.use(buildMiddlewares(layer.branches));
        }
      }
    });
    return rack;
  }

  self.build = function(layers) {
    apporo.use(buildMiddlewares(layers));
  }

  debugx.enabled && debugx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "webweaverService",
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
    "webserverTrigger": {
      "type": "object"
    }
  }
};

module.exports = Service;
