'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const pinbug = Devebot.require('pinbug');

const express = require('express');
const session = require('express-session');
const fileStore = require('session-file-store')(session);
const mongoStore = require('connect-mongo')(session);
const redisStore = require('connect-redis')(session);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

function WebweaverService(params) {
  params = params || {};
  let self = this;

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-webweaver';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = params.sandboxConfig || {};
  let webserverTrigger = params["app-webserver/webserverTrigger"];

  let apporo = express();

  let corsCfg = lodash.get(pluginCfg, "cors", {});
  if (corsCfg.enabled === true && corsCfg.mode === 'simple') {
    apporo.use(cors());
  }

  Object.defineProperty(self, 'outlet', {
    get: function() { return apporo },
    set: function(value) {}
  });

  webserverTrigger.attach(apporo);

  //---------------------------------------------------------------------------

  let debugx = null;
  let printRequestInfoInstance = function(req, res, next) {
    debugx = debugx || pinbug('app-webweaver:service');
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
    let sslUrls = sslProtectedUrls || pluginCfg.sslProtectedUrls || [];
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
          res.json({"status": "Access denied"}, 401);
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
    let cacheControlConfig = lodash.get(pluginCfg, ['cacheControl'], {});
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

  let sessionId = lodash.get(pluginCfg, 'session.name', 'sessionId');
  let sessionSecret = lodash.get(pluginCfg, 'session.secret', 's3cur3s3ss10n');
  let sessionCookie = lodash.get(pluginCfg, 'session.cookie', null);
  let sessionInstance = null;

  self.getSessionLayer = function(branches, path) {
    if (sessionInstance === null) {
      let sessionOpts = {
        resave: true,
        saveUninitialized: true,
        name: sessionId,
        secret: sessionSecret,
        cookie: sessionCookie
      };
      let sessionStoreDef = lodash.get(pluginCfg, ['session', 'store'], {});
      switch (sessionStoreDef.type) {
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

  let cookieParserInstance = null;

  self.getCookieParserLayer = function(branches, path) {
    cookieParserInstance = cookieParserInstance || cookieParser(sessionSecret);
    return {
      name: 'cookieParser',
      path: path,
      middleware: cookieParserInstance,
      branches: branches
    }
  }

  let jsonBodyParser = null;

  self.getJsonBodyParserLayer = function(branches, path) {
    jsonBodyParser = jsonBodyParser || bodyParser.json({
      limit: pluginCfg.jsonBodySizeLimit || '2mb',
      extended: true
    });
    return {
      name: 'bodyParser.json',
      path: path,
      middleware: jsonBodyParser,
      branches: branches
    }
  }

  let urlencodedBodyParser = null;

  self.getUrlencodedBodyParserLayer = function(branches, path) {
    urlencodedBodyParser = urlencodedBodyParser || bodyParser.urlencoded({
      limit: pluginCfg.urlencodedBodySizeLimit || undefined,
      extended: true
    });
    return {
      name: 'bodyParser.urlencoded',
      path: path,
      middleware: urlencodedBodyParser,
      branches: branches
    }
  }

  let compressionInstance = null;

  self.getCompressionLayer = function(branches, path) {
    compressionInstance = compressionInstance || require('compression')();
    return {
      name: 'compression',
      path: path,
      middleware: compressionInstance,
      branches: branches
    }
  }

  let csrfInstance = null;

  self.getCsrfLayer = function(branches, path) {
    csrfInstance = csrfInstance || require('csurf')({ cookie: { signed: true } });
    return {
      name: 'csurf',
      path: path,
      middleware: csrfInstance,
      branches: branches
    }
  }

  let helmetInstance = null;

  self.getHelmetLayer = function(branches, path) {
    helmetInstance = helmetInstance || require('helmet')();
    return {
      name: 'helmet',
      path: path,
      middleware: helmetInstance,
      branches: branches
    }
  }

  let methodOverrideInstance = null;

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
    let middleware = null;
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
    let layer = {
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

  let wireLayer = function(slot, layer, superTrail) {
    slot = slot || express();
    superTrail = superTrail || [];
    if (layer === null) return slot;
    layer.trails = superTrail.slice(0);
    layer.trails.push(layer.name);
    let footprint = layer.trails.join('>');
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

  let wireBranches = function(slot, layers, superTrail) {
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

  let bundles = [];
  let bundleFreezed = false;

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
      let sortedBundles = lodash.sortBy(bundles, function(bundle) {
        return bundle.priority;
      });
      lodash.forEach(sortedBundles, function(bundle) {
        self.wire(apporo, bundle.layerPack);
      });
      applyErrorHandler(apporo);
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'combine', 'combined' ],
        text: ' - combine(): bundles has been combined'
      }));
    }
  }

  // Deprecated
  self.inject = self.push;

  //---------------------------------------------------------------------------

  let errorHandlerCfg = pluginCfg.errorHandler || {};
  let errorMap = {};

  lodash.forEach(errorHandlerCfg.mappings, function(mapping) {
    let mappingRule = lodash.pick(mapping, ['default', 'transform']);
    let errorName = mapping.errorName;
    if (mapping.errorCode) {
      let errorFullName = mapping.errorName + '_' + mapping.errorCode;
      errorMap[errorFullName] = mappingRule;
    } else {
      errorMap[errorName] = mappingRule;
    }
    errorMap[errorName] = errorMap[errorName] || mappingRule;
  });

  let getErrorMappingId = function(error) {
    let mappingId = null;
    if (error && typeof error.name === 'string') {
      mappingId = error.name;
      if (mappingId && error.code) {
        mappingId = mappingId + '_' + error.code;
      }
    }
    return mappingId;
  }

  let transformError = function(error) {
    let mappingId = getErrorMappingId(error);
    if (mappingId && errorMap[mappingId]) {
      const mapping = errorMap[mappingId];
      let output = {};
      // apply transforming methods
      if (mapping.transform && lodash.isFunction(mapping.transform.statusCode)) {
        output.statusCode = mapping.transform.statusCode(error);
      }
      if (mapping.transform && lodash.isFunction(mapping.transform.statusMessage)) {
        output.statusMessage = mapping.transform.statusMessage(error);
      }
      if (mapping.transform && lodash.isFunction(mapping.transform.responseBody)) {
        output.responseBody = mapping.transform.responseBody(error);
      }
      // apply error properties
      if (!lodash.isString(output.statusMessage)) {
        output.statusMessage = error.message;
      }
      if (lodash.isEmpty(output.responseBody)) {
        output.responseBody = error.payload;
      }
      // apply mapping.default for undefined fields
      if (!lodash.isNumber(output.statusCode)) {
        output.statusCode = mapping.default && mapping.default.statusCode;
      }
      if (!lodash.isString(output.statusMessage)) {
        output.statusMessage = mapping.default && mapping.default.statusMessage;
      }
      if (lodash.isEmpty(output.responseBody)) {
        output.responseBody = mapping.default && mapping.default.responseBody;
      }
      // apply default statusCode
      output.statusCode = output.statusCode || 500;
      return output;
    }
    return {
      statusCode: 500,
      statusMessage: 'Unknown Error',
      responseBody: {
        type: typeof(error),
        name: error && error.name,
        code: error && error.code,
        message: error && error.message
      }
    }
  }

  let applyErrorHandler = function(slot) {
    slot.use(function (err, req, res, next) {
      if (res.headersSent) {
        return next(err);
      }
      let output = transformError(err);
      res.statusMessage = output.statusMessage;
      res.status(output.statusCode);
      if (output.responseBody) {
        if (lodash.isString(output.responseBody)) {
          res.send(output.responseBody);
        } else {
          res.json(output.responseBody);
        }
      } else {
        res.send();
      }
    });
  }

  let stringify = function(data) {
    if (data === undefined) data = null;
    if (typeof(data) === 'string') return data;
    var json = null;
    try {
      json = JSON.stringify(data);
    } catch (error) {
      json = JSON.stringify({ message: 'JSON.stringify() error' });
    }
    return json;
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
};

WebweaverService.referenceList = [ "app-webserver/webserverTrigger" ];

module.exports = WebweaverService;
