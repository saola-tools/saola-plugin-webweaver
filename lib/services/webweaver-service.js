'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appWebweaver:service');

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

  var logger = params.loggingFactory.getLogger();
  var pluginCfg = params.sandboxConfig;

  var apporo = express();

  Object.defineProperty(self, 'outlet', {
    get: function() { return apporo },
    set: function(value) {}
  });

  params.webserverTrigger.attach(apporo);

  //---------------------------------------------------------------------------

  var printRequestInfoInstance = function(req, res, next) {
    process.nextTick(function() {
      debugx('=@ webweaver receives a new request:');
      debugx(' - IP: %s / %s', req.ip, JSON.stringify(req.ips));
      debugx(' - protocol: ' + req.protocol);
      debugx(' - host: ' + req.hostname);
      debugx(' - path: ' + req.path);
      debugx(' - URL: ' + req.url);
      debugx(' - originalUrl: ' + req.originalUrl);
      debugx(' - body: ' + JSON.stringify(req.body));
      debugx(' - user-agent: ' + req.headers['user-agent']);
    });
    next();
  }

  self.getPrintRequestInfoLayer = function(branches, path) {
    return {
      skipped: !pluginCfg.printRequestInfo,
      name: 'printRequestInfo',
      path: path,
      middleware: printRequestInfoInstance,
      branches: branches
    }
  }

  self.getUrlSslProtectionLayer = function(branches, sslProtectedUrls) {
    var sslUrls = sslProtectedUrls || pluginCfg.sslProtectedUrls || [];
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
    var cacheControlConfig = lodash.get(pluginCfg, ['cacheControl'], {});
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

  var sessionId = lodash.get(pluginCfg, 'session.name', 'sessionId');
  var sessionSecret = lodash.get(pluginCfg, 'session.secret', 's3cur3s3ss10n');
  var sessionCookie = lodash.get(pluginCfg, 'session.cookie', null);
  var sessionInstance = null;

  self.getSessionLayer = function(branches, path) {
    if (sessionInstance === null) {
      var sessionOpts = {
        resave: true,
        saveUninitialized: true,
        name: sessionId,
        secret: sessionSecret,
        cookie: sessionCookie
      };
      var sessionStoreDef = lodash.get(pluginCfg, ['session', 'store'], {});
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
      sessionInstance = session(sessionOpts);
    }
    return {
      name: 'session',
      path: path,
      middleware: sessionInstance,
      branches: branches
    }
  }

  var cookieParserInstance = null;

  self.getCookieParserLayer = function(branches, path) {
    cookieParserInstance = cookieParserInstance || cookieParser(sessionSecret);
    return {
      name: 'cookieParser',
      path: path,
      middleware: cookieParserInstance,
      branches: branches
    }
  }

  var jsonBodyParser = null;

  self.getJsonBodyParserLayer = function(branches, path) {
    jsonBodyParser = jsonBodyParser || bodyParser.json({
      limit: pluginCfg.jsonBodySizeLimit || '2mb'
    });
    return {
      name: 'bodyParser.json',
      path: path,
      middleware: jsonBodyParser,
      branches: branches
    }
  }

  var urlencodedBodyParser = null;

  self.getUrlencodedBodyParserLayer = function(branches, path) {
    urlencodedBodyParser = urlencodedBodyParser || bodyParser.urlencoded({
      extended: true
    });
    return {
      name: 'bodyParser.urlencoded',
      path: path,
      middleware: urlencodedBodyParser,
      branches: branches
    }
  }

  var compressionInstance = null;

  self.getCompressionLayer = function(branches, path) {
    compressionInstance = compressionInstance || require('compression')();
    return {
      name: 'compression',
      path: path,
      middleware: compressionInstance,
      branches: branches
    }
  }

  var csrfInstance = null;

  self.getCsrfLayer = function(branches, path) {
    csrfInstance = csrfInstance || require('csurf')({ cookie: { signed: true } });
    return {
      name: 'csurf',
      path: path,
      middleware: csrfInstance,
      branches: branches
    }
  }

  var helmetInstance = null;

  self.getHelmetLayer = function(branches, path) {
    helmetInstance = helmetInstance || require('helmet')();
    return {
      name: 'helmet',
      path: path,
      middleware: helmetInstance,
      branches: branches
    }
  }

  var methodOverrideInstance = null;

  self.getMethodOverrideLayer = function(branches, path) {
    methodOverrideInstance = methodOverrideInstance || require('method-override')();
    return {
      name: 'methodOverride',
      path: path,
      middleware: methodOverrideInstance,
      branches: branches
    }
  }

  self.getChangePowerByLayer = function(branches, path) {
    var middleware = null;
    if (pluginCfg.setPoweredBy) {
      middleware = function setPoweredBy(req, res, next) {
        res.setHeader('X-Powered-By', pluginCfg.setPoweredBy);
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
    var layer = {
      skipped: true,
      name: 'defaultRedirect',
      path: ['/$'],
      middleware: function defaultRedirect(req, res, next) {
        res.redirect(pluginCfg.defaultRedirectUrl);
      }
    }
    if (pluginCfg.defaultRedirectUrl) {
      layer.skipped = false;
    }
    return layer;
  }

  //---------------------------------------------------------------------------

  var wireLayer = function(slot, layer, superTrail) {
    slot = slot || express();
    superTrail = superTrail || [];
    if (layer === null) return slot;
    layer.trails = superTrail.slice(0);
    layer.trails.push(layer.name);
    var footprint = layer.trails.join('>');
    if (layer.enabled !== false) {
      if (layer.skipped !== true && lodash.isFunction(layer.middleware)) {
        if (layer.path) {
          if (debugx.enabled) {
            var p = lodash.isString(layer.path) ? layer.path : JSON.stringify(layer.path);
            debugx.enabled && debugx(' - layer[%s] handles path: %s', footprint, p);
          }
          if (!(lodash.isArray(layer.path) && lodash.isEmpty(layer.path))) {
            slot.use(layer.path, layer.middleware);
          }
        } else {
          debugx.enabled && debugx(' - layer[%s] handles any request', footprint);
          slot.use(layer.middleware);
        }
      } else {
        debugx.enabled && debugx(' - layer[%s] is skipped', footprint);
      }
      if (lodash.isArray(layer.branches) && !lodash.isEmpty(layer.branches)) {
        slot.use(wireBranches(null, layer.branches, layer.trails));
      }
    } else {
      debugx.enabled && debugx(' - layer[%s] is disabled', footprint);
    }
    return slot;
  }

  var wireBranches = function(slot, layers, superTrail) {
    slot = slot || express();
    lodash.forEach(layers, function(layer) {
      wireLayer(slot, layer, superTrail);
    });
    return slot;
  }

  self.wire = function(slot, layerOrBranches, superTrail) {
    if (lodash.isArray(layerOrBranches)) {
      return wireBranches(slot, layerOrBranches, superTrail);
    } else {
      return wireLayer(slot, layerOrBranches, superTrail);
    }
  }

  //---------------------------------------------------------------------------

  var bundles = [];
  var bundleFreezed = false;

  self.inject = self.push = function(layerOrBranches, priority) {
    if (bundleFreezed) {
      debugx.enabled && debugx(' - inject(), but bundles has been freezed');
    } else {
      priority = lodash.isNumber(priority) ? priority : 0;
      bundles.push({ layerPack: layerOrBranches, priority: priority });
      debugx.enabled && debugx(' - inject() layerweb is injected to #%s', priority);
    }
  }

  self.combine = function() {
    if (bundleFreezed) {
      debugx.enabled && debugx(' - combine(), but bundles has been freezed');
    } else {
      bundleFreezed = true;
      var sortedBundles = lodash.sortBy(bundles, function(bundle) {
        return bundle.priority;
      });
      lodash.forEach(sortedBundles, function(bundle) {
        self.wire(apporo, bundle.layerPack);
      });
      debugx.enabled && debugx(' - combine(): bundles has been combined');
    }
  }

  //---------------------------------------------------------------------------

  Object.defineProperties(self, {
    express: {
      get: function() { return express },
      set: function(value) {}
    },
    session: {
      get: function() { return sessionInstance },
      set: function(value) {}
    }
  });

  debugx.enabled && debugx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "webweaverService",
  "type": "object",
  "properties": {
    "webserverTrigger": {
      "type": "object"
    }
  }
};

module.exports = Service;
