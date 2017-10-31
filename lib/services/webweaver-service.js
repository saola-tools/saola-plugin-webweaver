'use strict';

var events = require('events');
var util = require('util');
var fs = require('fs');
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

  self.getApporo = function() {
    return apporo;
  };

  if (params.webserverTrigger.ssl.available &&
      webweaverConfig.sslProtectedUrls instanceof Array &&
      webweaverConfig.sslProtectedUrls.length > 0) {
    var sslUrls = webweaverConfig.sslProtectedUrls || [];
    apporo.use(sslUrls, function(req, res, next) {
      if (req.client.authorized) {
        next();
        debugx.enabled && debugx(" - Passed Client: %s", req.originalUrl);
      } else {
        res.json({"status":"Access denied"}, 401);
        debugx.enabled && debugx(" - Denied client: %s", req.originalUrl);
      }
    });
  }

  if (debugx.enabled && webweaverConfig.printRequestInfo) {
    apporo.use('*', function(req, res, next) {
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
    });
  }

  var cacheControlConfig = lodash.get(webweaverConfig, ['cacheControl'], {});
  if (cacheControlConfig.enabled) {
    apporo.use(function(req, res, next) {
      if (cacheControlConfig.pattern && cacheControlConfig.pattern.url &&
          req.url.match(cacheControlConfig.pattern.url)) {
        res.setHeader('Cache-Control', 'public, max-age=' + cacheControlConfig.maxAge);
      }
      next();
    });
  }

  var interceptor = {};

  var sessionOpts = {
    resave: true,
    saveUninitialized: true
  };
  sessionOpts.name = lodash.get(webweaverConfig, 'session.name', 'sessionId');
  sessionOpts.secret = lodash.get(webweaverConfig, 'session.secret', 's3cur3s3ss10n');

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

  interceptor['session'] = {
    handler: session(sessionOpts)
  }

  interceptor['cookie-parser'] = {
    handler: cookieParser(sessionOpts.secret)
  };

  interceptor['body-parser-json'] = {
    handler: bodyParser.json({ limit: webweaverConfig.jsonBodySizeLimit || '2mb' })
  }

  interceptor['body-parser-urlencoded'] = {
    handler: bodyParser.urlencoded({ extended: true })
  }

  interceptor['compression'] = {
    handler: require('compression')()
  }

  interceptor['csurf'] = {
    handler: require('csurf')({ cookie: { signed: true } })
  }

  interceptor['helmet'] = {
    handler: require('helmet')()
  }

  interceptor['method-override'] = {
    handler: require('method-override')()
  }

  var sessionInstance = interceptor['session'].handler;

  self.getSession = function() {
    return sessionInstance;
  };

  var cookieParserInstance = interceptor['cookie-parser'].handler;

  self.getCookieParser = function() {
    return cookieParserInstance;
  };

  var positionInstance = new (function() {
    var inRangeOf = function(minVal, maxVal, priority) {
      this.counter = this.counter || 0;
      priority = lodash.isNumber(priority) ? priority : ++this.counter;
      if (minVal && lodash.isNumber(minVal)) {
        priority = minVal + priority;
        priority = (priority < minVal) ? minVal : priority;
      }
      if (maxVal && lodash.isNumber(maxVal) && minVal <= maxVal) {
        priority = (maxVal < priority) ? maxVal : priority;
      }
      return priority;
    };

    this.POSITION_COMPRESSION = -10000;
    this.POSITION_COOKIE_PARSER = -150;
    this.POSITION_SESSION = -120;
    this.POSITION_TOKENIFY = -117;
    this.POSITION_TRACELOG_LISTENER = -115;
    this.POSITION_TRACELOG_BOUNDARY = -114;
    this.POSITION_PROXIFY = -113;
    this.POSITION_BODY_PARSER = -100;
    this.POSITION_METHOD_OVERRIDE = -98;
    this.POSITION_CSRF = -97;
    this.POSITION_HELMET = -96;

    this.POSITION_UNRESTRICTED_BEGIN = -50;
    this.POSITION_UNRESTRICTED_END = -10;

    this.POSITION_AUTHENTICATION = -1;

    this.POSITION_BEGIN_MIDDLEWARE = 0;
    this.POSITION_END_MIDDLEWARE = 10000;

    this.contextForStaticFiles = { counter: 0 };
    this.inRangeOfStaticFiles = inRangeOf.bind(this.contextForStaticFiles,
        this.POSITION_COMPRESSION + 1,
        this.POSITION_COOKIE_PARSER - 1);

    this.contextForUnrestricted = { counter: 0 };
    this.inRangeOfUnrestricted = inRangeOf.bind(this.contextForUnrestricted,
        this.POSITION_UNRESTRICTED_BEGIN,
        this.POSITION_UNRESTRICTED_END);

    this.contextForMiddlewares = { counter: 0 };
    this.inRangeOfMiddlewares = inRangeOf.bind(this.contextForMiddlewares,
        this.POSITION_BEGIN_MIDDLEWARE,
        this.POSITION_END_MIDDLEWARE);

    this.contextAfterMiddlewares = { counter: 0 };
    this.afterMiddlewares = inRangeOf.bind(this.contextAfterMiddlewares,
        this.POSITION_END_MIDDLEWARE + 1);
  })();

  self.getPosition = function() {
    return positionInstance;
  }

  var routers = [];

  routers.push({
    name: 'cookie-parser',
    middleware: cookieParserInstance,
    priority: positionInstance.POSITION_COOKIE_PARSER
  }, {
    name: 'session',
    middleware: sessionInstance,
    priority: positionInstance.POSITION_SESSION
  }, {
    name: 'body-parser-json',
    middleware: interceptor['body-parser-json'].handler,
    priority: positionInstance.POSITION_BODY_PARSER
  }, {
    name: 'body-parser-urlencoded',
    middleware: interceptor['body-parser-urlencoded'].handler,
    priority: positionInstance.POSITION_BODY_PARSER
  });

  if (process.env.NODE_ENV == 'production') {
    routers.push({
      name: 'compression',
      middleware: interceptor['compression'].handler,
      priority: positionInstance.POSITION_COMPRESSION
    }, {
      name: 'method-override',
      middleware: interceptor['method-override'].handler,
      priority: positionInstance.POSITION_METHOD_OVERRIDE
    }, {
      name: 'csurf',
      middleware: interceptor['csurf'].handler,
      priority: positionInstance.POSITION_CSRF
    }, {
      name: 'helmet',
      middleware: interceptor['helmet'].handler,
      priority: positionInstance.POSITION_HELMET
    });
  }

  if (webweaverConfig.setPoweredBy) {
    routers.push({
      name: 'setPoweredBy',
      middleware: function setPoweredBy(req, res, next) {
        res.setHeader('X-Powered-By', webweaverConfig.setPoweredBy);
        next();
      },
      priority: positionInstance.inRangeOfMiddlewares()
    });
  } else {
    routers.push({
      name: 'hidePoweredBy',
      middleware: function hidePoweredBy(req, res, next) {
        res.removeHeader('X-Powered-By');
        next();
      },
      priority: positionInstance.inRangeOfMiddlewares()
    });
  }

  if (webweaverConfig.defaultRedirectUrl) {
    routers.push({
      name: 'defaultRedirect',
      path: ['/$'],
      middleware: function defaultRedirect(req, res, next) {
        res.redirect(webweaverConfig.defaultRedirectUrl);
      },
      priority: positionInstance.afterMiddlewares()
    });
  }

  self.inject = function(middleware, path, priority, name) {
    if (lodash.isObject(middleware)) {
      priority = lodash.isNumber(priority) ? priority : 0;

      if (lodash.isFunction(middleware)) {
        middleware = {
          name: name,
          path: path,
          middleware: middleware,
          priority: priority
        };
      }

      routers.push(middleware);
    }
  };

  self.combine = function() {
    var sortedRouters = lodash.sortBy(routers, function(router) {
      return router.priority;
    });

    if (debugx.enabled) {
      lodash.forEach(sortedRouters, function(router) {
        debugx.enabled && debugx(' -> middleware [%s] is loaded at [%s], in priority: %s',
          router.name,
          router.path || '/',
          router.priority);
      });
    }

    lodash.forEach(sortedRouters, function(router) {
      if (router.path) {
        if (!(lodash.isArray(router.path) && lodash.isEmpty(router.path))) {
          apporo.use(router.path, router.middleware);
        }
      } else {
        apporo.use(router.middleware);
      }
    });
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
