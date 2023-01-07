"use strict";

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");
const pinbug = Devebot.require("pinbug");

const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const MongoStore = require("connect-mongo")(session);
const RedisStore = require("connect-redis")(session);
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { DEFAULT_RUNLET_NAME, standardizeConfig } = require("app-webserver").require("runlet");

function WebweaverService (params) {
  const { packageName, loggingFactory, sandboxConfig, webserverHandler } = params || {};

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName || "app-webweaver");

  //---------------------------------------------------------------------------

  const pluginConfig = standardizeConfig(sandboxConfig);

  const _runlets = {};
  lodash.forOwn(pluginConfig.runlets, function(runletConfig, runletName) {
    _runlets[runletName] = new WebweaverRunlet({ L, T, blockRef, runletConfig, runletName, webserverHandler });
  });

  this.getRunletNames = function() {
    return lodash.keys(_runlets);
  };

  this.hasRunlet = function(runletName) {
    runletName = runletName || DEFAULT_RUNLET_NAME;
    if (!webserverHandler.hasRunlet(runletName)) {
      return false;
    }
    return runletName in _runlets;
  };

  this.getRunlet = function(runletName) {
    runletName = runletName || DEFAULT_RUNLET_NAME;
    return _runlets[runletName];
  };

  //---------------------------------------------------------------------------

  // @deprecated
  this.getPrintRequestInfoLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getPrintRequestInfoLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getUrlSslProtectionLayer = function(branches, sslProtectedUrls) {
    return this.hasRunlet() && this.getRunlet().getUrlSslProtectionLayer(branches, sslProtectedUrls) || undefined;
  };

  // @deprecated
  this.getCacheControlLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getCacheControlLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getSessionLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getSessionLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getCookieParserLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getCookieParserLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getJsonBodyParserLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getJsonBodyParserLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getUrlencodedBodyParserLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getUrlencodedBodyParserLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getCompressionLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getCompressionLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getCsrfLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getCsrfLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getHelmetLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getHelmetLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getMethodOverrideLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getMethodOverrideLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getChangePowerByLayer = function(branches, path) {
    return this.hasRunlet() && this.getRunlet().getChangePowerByLayer(branches, path) || undefined;
  };

  // @deprecated
  this.getDefaultRedirectLayer = function(path) {
    return this.hasRunlet() && this.getRunlet().getDefaultRedirectLayer(path) || undefined;
  };

  // @deprecated
  this.createStaticFilesLayer = function(layerDef, staticFilesDir) {
    return this.hasRunlet() && this.getRunlet().createStaticFilesLayer(layerDef, staticFilesDir) || undefined;
  };

  // @deprecated
  this.push = function(layerOrBranches, priority) {
    return this.hasRunlet() && this.getRunlet().push(layerOrBranches, priority) || undefined;
  };

  this.combine = function() {
    const runletNames = this.getRunletNames();
    const selectedRunlets = [];
    for (const runletName of runletNames) {
      if (this.hasRunlet(runletName)) {
        const selectedRunlet = this.getRunlet(runletName);
        if (selectedRunlet) {
          selectedRunlets.push(selectedRunlet);
        }
      }
    }
    //
    return Promise.mapSeries(selectedRunlets, function(runlet) {
      return runlet.combine();
    });
  };

  // @deprecated
  this.wire = function(slot, layerOrBranches, superTrail) {
    return this.hasRunlet() && this.getRunlet().wire(slot, layerOrBranches, superTrail) || undefined;
  };

  // @deprecated
  this.inject = this.push;

  Object.defineProperties(this, {
    express: {
      get: function() {
        return express;
      },
      set: function(value) {}
    },
    session: {
      get: function() {
        return this.hasRunlet() && this.getRunlet().session || undefined;
      },
      set: function(value) {}
    }
  });
}

function WebweaverRunlet (params) {
  const { L, T, blockRef, runletConfig, runletName, webserverHandler } = params || {};

  const apporo = express();

  Object.defineProperty(this, "outlet", {
    get: function() { return apporo; },
    set: function(value) {}
  });

  webserverHandler.getRunlet(runletName).attach(apporo);

  //---------------------------------------------------------------------------

  const corsCfg = lodash.get(runletConfig, "cors", {});
  if (corsCfg.enabled === true && corsCfg.mode === "simple") {
    apporo.use(cors());
  }

  //---------------------------------------------------------------------------

  this.getPrintRequestInfoLayer = function(branches, path) {
    let debugx = null;
    let printRequestInfoInstance = function(req, res, next) {
      debugx = debugx || pinbug("app-webweaver:service");
      process.nextTick(function() {
        debugx.enabled && debugx("=@ webweaver receives a new request:");
        debugx.enabled && debugx(" - IP: %s / %s", req.ip, JSON.stringify(req.ips));
        debugx.enabled && debugx(" - protocol: " + req.protocol);
        debugx.enabled && debugx(" - host: " + req.hostname);
        debugx.enabled && debugx(" - path: " + req.path);
        debugx.enabled && debugx(" - URL: " + req.url);
        debugx.enabled && debugx(" - originalUrl: " + req.originalUrl);
        debugx.enabled && debugx(" - body: " + JSON.stringify(req.body));
        debugx.enabled && debugx(" - user-agent: " + req.headers["user-agent"]);
      });
      next();
    };
    return {
      skipped: !runletConfig.printRequestInfo,
      name: "printRequestInfo",
      path: path,
      middleware: printRequestInfoInstance,
      branches: branches
    };
  };

  this.getUrlSslProtectionLayer = function(branches, sslProtectedUrls) {
    let sslUrls = sslProtectedUrls || runletConfig.sslProtectedUrls || [];
    return {
      name: "urlProtectionBySSL",
      path: sslUrls,
      middleware: function(req, res, next) {
        if (req.client.authorized) {
          next();
          L && L.has("silly") && L.log("silly", T && T.add({
            url: req.originalUrl
          }).toMessage({
            tags: [ blockRef, "url-ssl-protection-layer", "passed" ],
            text: " - Passed Client: ${url}"
          }));
        } else {
          res.json({"status": "Access denied"}, 401);
          L && L.has("silly") && L.log("silly", T && T.add({
            url: req.originalUrl
          }).toMessage({
            tags: [ blockRef, "url-ssl-protection-layer", "denied" ],
            text: " - Denied Client: ${url}"
          }));
        }
      },
      branches: branches
    };
  };

  this.getCacheControlLayer = function(branches, path) {
    let cacheControlConfig = lodash.get(runletConfig, ["cacheControl"], {});
    return {
      name: "cacheControl",
      path: path,
      middleware: function(req, res, next) {
        if (cacheControlConfig.pattern && cacheControlConfig.pattern.url &&
            req.url.match(cacheControlConfig.pattern.url)) {
          res.setHeader("Cache-Control", "public, max-age=" + cacheControlConfig.maxAge);
        }
        next();
      },
      branches: branches
    };
  };

  let sessionId = lodash.get(runletConfig, "session.name", "sessionId");
  let sessionSecret = lodash.get(runletConfig, "session.secret", "s3cur3s3ss10n");
  let sessionCookie = lodash.get(runletConfig, "session.cookie", null);
  let sessionInstance = null;

  this.getSessionLayer = function(branches, path) {
    if (sessionInstance === null) {
      let sessionOpts = {
        resave: true,
        saveUninitialized: true,
        name: sessionId,
        secret: sessionSecret,
        cookie: sessionCookie
      };
      let sessionStoreDef = lodash.get(runletConfig, ["session", "store"], {});
      switch (sessionStoreDef.type) {
        case "file":
          sessionOpts.store = new FileStore({
            path: sessionStoreDef.path
          });
          L && L.has("silly") && L.log("silly", T && T.add({
            sessionStoreType: "fileStore",
            urlOrPath: sessionStoreDef.path
          }).toMessage({
            tags: [ blockRef, "session-store-set" ],
            text: " - session.store ~ ${sessionStoreType}"
          }));
          break;
        case "redis":
          sessionOpts.store = new RedisStore({
            url: sessionStoreDef.url
          });
          L && L.has("silly") && L.log("silly", T && T.add({
            sessionStoreType: "redisStore",
            urlOrPath: sessionStoreDef.url
          }).toMessage({
            tags: [ blockRef, "session-store-set" ],
            text: " - session.store ~ ${sessionStoreType}"
          }));
          break;
        case "mongodb":
          sessionOpts.store = new MongoStore({
            url: sessionStoreDef.url
          });
          L && L.has("silly") && L.log("silly", T && T.add({
            sessionStoreType: "mongoStore",
            urlOrPath: sessionStoreDef.url
          }).toMessage({
            tags: [ blockRef, "session-store-set" ],
            text: " - session.store ~ ${sessionStoreType}"
          }));
          break;
        default:
          L && L.has("silly") && L.log("silly", T && T.add({
            sessionStoreType: "memoryStore"
          }).toMessage({
            tags: [ blockRef, "session-store-set" ],
            text: " - session.store ~ ${sessionStoreType} (default)"
          }));
      }
      sessionInstance = session(sessionOpts);
    }
    return {
      name: "session",
      path: path,
      middleware: sessionInstance,
      branches: branches
    };
  };

  let cookieParserInstance = null;

  this.getCookieParserLayer = function(branches, path) {
    cookieParserInstance = cookieParserInstance || cookieParser(sessionSecret);
    return {
      name: "cookieParser",
      path: path,
      middleware: cookieParserInstance,
      branches: branches
    };
  };

  let jsonBodyParser = null;

  this.getJsonBodyParserLayer = function(branches, path) {
    jsonBodyParser = jsonBodyParser || bodyParser.json({
      limit: runletConfig.jsonBodySizeLimit || "2mb",
      extended: true
    });
    return {
      name: "bodyParser.json",
      path: path,
      middleware: jsonBodyParser,
      branches: branches
    };
  };

  let urlencodedBodyParser = null;

  this.getUrlencodedBodyParserLayer = function(branches, path) {
    urlencodedBodyParser = urlencodedBodyParser || bodyParser.urlencoded({
      limit: runletConfig.urlencodedBodySizeLimit || undefined,
      extended: true
    });
    return {
      name: "bodyParser.urlencoded",
      path: path,
      middleware: urlencodedBodyParser,
      branches: branches
    };
  };

  let compressionInstance = null;

  this.getCompressionLayer = function(branches, path) {
    compressionInstance = compressionInstance || require("compression")();
    return {
      name: "compression",
      path: path,
      middleware: compressionInstance,
      branches: branches
    };
  };

  let csrfInstance = null;

  this.getCsrfLayer = function(branches, path) {
    csrfInstance = csrfInstance || require("csurf")({ cookie: { signed: true } });
    return {
      name: "csurf",
      path: path,
      middleware: csrfInstance,
      branches: branches
    };
  };

  let helmetInstance = null;

  this.getHelmetLayer = function(branches, path) {
    helmetInstance = helmetInstance || require("helmet")();
    return {
      name: "helmet",
      path: path,
      middleware: helmetInstance,
      branches: branches
    };
  };

  let methodOverrideInstance = null;

  this.getMethodOverrideLayer = function(branches, path) {
    methodOverrideInstance = methodOverrideInstance || require("method-override")();
    return {
      name: "methodOverride",
      path: path,
      middleware: methodOverrideInstance,
      branches: branches
    };
  };

  this.getChangePowerByLayer = function(branches, path) {
    let middleware = null;
    if (runletConfig.setPoweredBy) {
      middleware = function setPoweredBy (req, res, next) {
        res.setHeader("X-Powered-By", runletConfig.setPoweredBy);
        next();
      };
    } else {
      middleware = function hidePoweredBy (req, res, next) {
        res.removeHeader("X-Powered-By");
        next();
      };
    }
    return {
      name: "changePowerBy",
      path: path,
      middleware: middleware,
      branches: branches
    };
  };

  this.getDefaultRedirectLayer = function(path) {
    let layer = {
      skipped: true,
      name: "defaultRedirect",
      path: path || ["/$"],
      middleware: function defaultRedirect (req, res, next) {
        res.redirect(runletConfig.defaultRedirectUrl);
      }
    };
    if (runletConfig.defaultRedirectUrl) {
      layer.skipped = false;
    }
    return layer;
  };

  //---------------------------------------------------------------------------

  this.createStaticFilesLayer = function(layerDef, staticFilesDir) {
    return lodash.merge({}, layerDef, {
      middleware: express.static(staticFilesDir)
    });
  };

  this.settleBranchQueueLayer = function(branchQueue, name) {
    branchQueue = branchQueue || {
      name: name || "app-webweaver-unknown",
      middleware: express()
    };
    return branchQueue;
  };

  //---------------------------------------------------------------------------

  Object.defineProperties(this, {
    session: {
      get: function() {
        return sessionInstance;
      },
      set: function(value) {}
    }
  });

  //---------------------------------------------------------------------------

  let bundles = [];
  let bundleFreezed = false;

  this.push = function(layerOrBranches, priority) {
    if (bundleFreezed) {
      L && L.has("silly") && L.log("silly", T && T.toMessage({
        tags: [ blockRef, "inject", "freezed" ],
        text: " - inject(), but bundles has been freezed"
      }));
    } else {
      priority = lodash.isNumber(priority) ? priority : 0;
      bundles.push({ layerPack: layerOrBranches, priority: priority });
      L && L.has("silly") && L.log("silly", T && T.add({
        priority: priority
      }).toMessage({
        tags: [ blockRef, "inject", "injected" ],
        text: " - inject() layerweb is injected to #${priority}"
      }));
    }
  };

  this.combine = function() {
    const self = this;
    if (bundleFreezed) {
      L && L.has("silly") && L.log("silly", T && T.toMessage({
        tags: [ blockRef, "combine", "freezed" ],
        text: " - combine(), but bundles has been freezed"
      }));
    } else {
      bundleFreezed = true;
      let sortedBundles = lodash.sortBy(bundles, function(bundle) {
        return bundle.priority;
      });
      //
      lodash.forEach(sortedBundles, function(bundle) {
        self.wire(apporo, bundle.layerPack);
      });
      //
      applyErrorHandler({ errorMap }, apporo);
      //
      L && L.has("silly") && L.log("silly", T && T.toMessage({
        tags: [ blockRef, "combine", "combined" ],
        text: " - combine(): bundles has been combined"
      }));
    }
  };

  this.wire = function(slot, layerOrBranches, superTrail) {
    const context = { L, T, blockRef, express };
    return wire(context, slot, layerOrBranches, superTrail);
  };

  //---------------------------------------------------------------------------

  let errorHandlerCfg = runletConfig.errorHandler || {};
  let errorMap = {};

  lodash.forEach(errorHandlerCfg.mappings, function(mapping) {
    let mappingRule = lodash.pick(mapping, ["default", "transform"]);
    let errorName = mapping.errorName;
    if (mapping.errorCode) {
      let errorFullName = mapping.errorName + "_" + mapping.errorCode;
      errorMap[errorFullName] = mappingRule;
    } else {
      errorMap[errorName] = mappingRule;
    }
    errorMap[errorName] = errorMap[errorName] || mappingRule;
  });
}

WebweaverService.referenceHash = {
  webserverHandler: "app-webserver/webserverHandler"
};

module.exports = WebweaverService;

function wire (context, slot, layerOrBranches, superTrail) {
  if (lodash.isArray(layerOrBranches)) {
    return wireBranches(context, slot, layerOrBranches, superTrail);
  } else {
    return wireLayer(context, slot, layerOrBranches, superTrail);
  }
}

function wireLayer (context, slot, layer, superTrail) {
  const { L, T, blockRef } = context || {};
  //
  slot = slot || createRouter(context);
  superTrail = superTrail || [];
  //
  if (layer === null || layer === undefined) return slot;
  //
  layer.trails = superTrail.slice(0);
  layer.trails.push(layer.name);
  //
  let footprint = layer.trails.join(">");
  //
  if (layer.enabled !== false) {
    if (layer.skipped !== true && lodash.isFunction(layer.middleware)) {
      if (layer.path) {
        L && L.has("silly") && L.log("silly", T && T.add({
          footprint: footprint,
          path: lodash.isString(layer.path) ? layer.path : JSON.stringify(layer.path)
        }).toMessage({
          tags: [ blockRef, "wire-layer", "layer-path-on" ],
          text: " - layer[${footprint}] handles path: ${path}"
        }));
        if (!(lodash.isArray(layer.path) && lodash.isEmpty(layer.path))) {
          slot.use(layer.path, layer.middleware);
        }
      } else {
        L && L.has("silly") && L.log("silly", T && T.add({
          footprint: footprint
        }).toMessage({
          tags: [ blockRef, "wire-layer", "layer-path-off" ],
          text: " - layer[${footprint}] handles any request"
        }));
        slot.use(layer.middleware);
      }
    } else {
      L && L.has("silly") && L.log("silly", T && T.add({
        footprint: footprint
      }).toMessage({
        tags: [ blockRef, "wire-layer", "layer-skipped" ],
        text: " - layer[${footprint}] is skipped"
      }));
    }
    if (lodash.isArray(layer.branches) && !lodash.isEmpty(layer.branches)) {
      slot.use(wireBranches(context, null, layer.branches, layer.trails));
    }
  } else {
    L && L.has("silly") && L.log("silly", T && T.add({
      footprint: footprint
    }).toMessage({
      tags: [ blockRef, "wire-layer", "layer-disabled" ],
      text: " - layer[${footprint}] is disabled"
    }));
  }
  //
  return slot;
}

function wireBranches (context, slot, layers, superTrail) {
  slot = slot || createRouter(context);
  lodash.forEach(layers, function(layer) {
    wireLayer(context, slot, layer, superTrail);
  });
  return slot;
}

function createRouter (context) {
  const { express } = context || {};
  return express();
}

function applyErrorHandler (context, slot) {
  slot.use(function (err, req, res, next) {
    if (res.headersSent) {
      return next(err);
    }
    let output = transformError(context, err);
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

function transformError (context, error) {
  const { errorMap } = context || {};
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
    statusMessage: "Unknown Error",
    responseBody: {
      type: typeof(error),
      name: error && error.name,
      code: error && error.code,
      message: error && error.message
    }
  };
}

function getErrorMappingId (error) {
  let mappingId = null;
  if (error && typeof error.name === "string") {
    mappingId = error.name;
    if (mappingId && error.code) {
      mappingId = mappingId + "_" + error.code;
    }
  }
  return mappingId;
}
