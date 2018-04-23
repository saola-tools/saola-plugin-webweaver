'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var pinbug = Devebot.require('pinbug');

var express = require('express');
var session = require('express-session');
var fileStore = require('session-file-store')(session);
var mongoStore = require('connect-mongo')(session);
var redisStore = require('connect-redis')(session);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

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

  var pluginCfg = params.sandboxConfig;
  var webserverTrigger = params["webserverTrigger"];

  var apporo = express();

  Object.defineProperty(self, 'outlet', {
    get: function() { return apporo },
    set: function(value) {}
  });

  webserverTrigger.attach(apporo);

  //---------------------------------------------------------------------------

  var debugx = pinbug('app-webweaver:service');
  var printRequestInfoInstance = function(req, res, next) {
    process.nextTick(function() {
      debugx.enabled && debugx('=@ webweaver receives a new request:');
      debugx.enabled && debugx(' - IP: %s / %s', req.ip, JSON.stringify(req.ips));
      debugx.enabled && debugx(' - protocol: ' + req.protocol);
      debugx.enabled && debugx(' - host: ' + req.hostname);
      debugx.enabled && debugx(' - path: ' + req.path);
      debugx.enabled && debugx(' - URL: ' + req.url);
      debugx.enabled && debugx(' - originalUrl: ' + req.originalUrl);
      debugx.enabled && debugx(' - body: ' + JSON.stringify(req.body));
      debugx.enabled && debugx(' - user-agent: ' + req.headers['user-agent']);
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
          LX.has('silly') && LX.log('silly', LT.add({
            url: req.originalUrl
          }).toMessage({
            tags: [ blockRef, 'url-ssl-protection-layer', 'passed' ],
            text: ' - Passed Client: ${url}'
          }));
        } else {
          res.json({"status":"Access denied"}, 401);
          LX.has('silly') && LX.log('silly', LT.add({
            url: req.originalUrl
          }).toMessage({
            tags: [ blockRef, 'url-ssl-protection-layer', 'denied' ],
            text: ' - Denied Client: ${url}'
          }));
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
          LX.has('silly') && LX.log('silly', LT.add({
            sessionStoreType: 'fileStore',
            urlOrPath: sessionStoreDef.path
          }).toMessage({
            tags: [ blockRef, 'session-store-set' ],
            text: ' - session.store ~ ${sessionStoreType}'
          }));
          break;
        case 'redis':
          sessionOpts.store = new redisStore({
            url: sessionStoreDef.url
          });
          LX.has('silly') && LX.log('silly', LT.add({
            sessionStoreType: 'redisStore',
            urlOrPath: sessionStoreDef.url
          }).toMessage({
            tags: [ blockRef, 'session-store-set' ],
            text: ' - session.store ~ ${sessionStoreType}'
          }));
          break;
        case 'mongodb':
          sessionOpts.store = new mongoStore({
            url: sessionStoreDef.url
          });
          LX.has('silly') && LX.log('silly', LT.add({
            sessionStoreType: 'mongoStore',
            urlOrPath: sessionStoreDef.url
          }).toMessage({
            tags: [ blockRef, 'session-store-set' ],
            text: ' - session.store ~ ${sessionStoreType}'
          }));
          break;
        default:
          LX.has('silly') && LX.log('silly', LT.add({
            sessionStoreType: 'memoryStore'
          }).toMessage({
            tags: [ blockRef, 'session-store-set' ],
            text: ' - session.store ~ ${sessionStoreType} (default)'
          }));
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

  self.getDefaultRedirectLayer = function(path) {
    var layer = {
      skipped: true,
      name: 'defaultRedirect',
      path: path || ['/$'],
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

  self.createStaticFilesLayer = function(layerDef, staticFilesDir) {
    return lodash.merge({}, layerDef, {
      middleware: express.static(staticFilesDir)
    });
  }

  self.settleBranchQueueLayer = function(branchQueue, name) {
    branchQueue = branchQueue || {
      name: name || 'app-webweaver-unknown',
      middleware: express()
    };
    return branchQueue;
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
          LX.has('silly') && LX.log('silly', LT.add({
            footprint: footprint,
            path: lodash.isString(layer.path) ? layer.path : JSON.stringify(layer.path)
          }).toMessage({
            tags: [ blockRef, 'wire-layer', 'layer-path-on' ],
            text: ' - layer[${footprint}] handles path: ${path}'
          }));
          if (!(lodash.isArray(layer.path) && lodash.isEmpty(layer.path))) {
            slot.use(layer.path, layer.middleware);
          }
        } else {
          LX.has('silly') && LX.log('silly', LT.add({
            footprint: footprint
          }).toMessage({
            tags: [ blockRef, 'wire-layer', 'layer-path-off' ],
            text: ' - layer[${footprint}] handles any request'
          }));
          slot.use(layer.middleware);
        }
      } else {
        LX.has('silly') && LX.log('silly', LT.add({
          footprint: footprint
        }).toMessage({
          tags: [ blockRef, 'wire-layer', 'layer-skipped' ],
          text: ' - layer[${footprint}] is skipped'
        }));
      }
      if (lodash.isArray(layer.branches) && !lodash.isEmpty(layer.branches)) {
        slot.use(wireBranches(null, layer.branches, layer.trails));
      }
    } else {
      LX.has('silly') && LX.log('silly', LT.add({
        footprint: footprint
      }).toMessage({
        tags: [ blockRef, 'wire-layer', 'layer-disabled' ],
        text: ' - layer[${footprint}] is disabled'
      }));
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

  self.push = function(layerOrBranches, priority) {
    if (bundleFreezed) {
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'inject', 'freezed' ],
        text: ' - inject(), but bundles has been freezed'
      }));
    } else {
      priority = lodash.isNumber(priority) ? priority : 0;
      bundles.push({ layerPack: layerOrBranches, priority: priority });
      LX.has('silly') && LX.log('silly', LT.add({
        priority: priority
      }).toMessage({
        tags: [ blockRef, 'inject', 'injected' ],
        text: ' - inject() layerweb is injected to #${priority}'
      }));
    }
  }

  self.combine = function() {
    if (bundleFreezed) {
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'combine', 'freezed' ],
        text: ' - combine(), but bundles has been freezed'
      }));
    } else {
      bundleFreezed = true;
      var sortedBundles = lodash.sortBy(bundles, function(bundle) {
        return bundle.priority;
      });
      lodash.forEach(sortedBundles, function(bundle) {
        self.wire(apporo, bundle.layerPack);
      });
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'combine', 'combined' ],
        text: ' - combine(): bundles has been combined'
      }));
    }
  }

  // Deprecated
  self.inject = self.push;

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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.referenceList = [ "webserverTrigger" ];

module.exports = Service;
