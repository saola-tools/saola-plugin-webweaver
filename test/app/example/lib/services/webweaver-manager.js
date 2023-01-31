"use strict";

const Devebot = require("@saola/core");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");
const pinbug = Devebot.require("pinbug");
const util = require("util");

const targetPortlet = "manager";

function Service (params) {
  const debugx = pinbug("saola-plugin-webweaver:example");
  debugx.enabled && debugx(" + constructor begin ...");

  params = params || {};
  const { sandboxConfig, webweaverService } = params;

  const express = webweaverService.express;
  debugx.enabled && debugx("configuration: %s", JSON.stringify(sandboxConfig));

  const getLayer1 = function(branches) {
    return {
      name: "app1",
      path: ["*"],
      middleware: function(req, res, next) {
        process.nextTick(function() {
          debugx("=@ example receives a new request:");
          debugx(" - Invoker IP: %s / %s", req.ip, JSON.stringify(req.ips));
          debugx(" - protocol: " + req.protocol);
          debugx(" - host: " + req.hostname);
          debugx(" - path: " + req.path);
          debugx(" - URL: " + req.url);
          debugx(" - originalUrl: " + req.originalUrl);
          debugx(" - body: " + JSON.stringify(req.body));
          debugx(" - user-agent: " + req.headers["user-agent"]);
        });
        next();
      },
      branches: branches
    };
  };

  const sampleOfErrors = {
    "simple-error": {
      constructor: Error,
      message: "very simple error"
    },
    "error-without-code": {
      constructor: Error, //chores.buildError('NoCodeError'),
      message: "error without code"
    }
  };

  const getLayer2 = function(branches) {
    return {
      name: "app2",
      middleware: (function() {
        const app2 = express();
        app2.get("/example/:id", function(req, res) {
          res.status(200).json({
            message: "example [" + req.params.id + "] request successfully"
          });
        });
        app2.get("/error", function(req, res) {
          res.status(200).json({
            entrypoints: lodash.keys(sampleOfErrors)
          });
        });
        app2.get("/error/:sampleId", function(req, res) {
          const sampleId = req.params.sampleId;
          if (sampleOfErrors[sampleId]) {
            const def = sampleOfErrors[sampleId];
            throw new def.constructor(util.format("Status Message [%s]", def.message));
          }
          throw new Error(util.format("Status Message - Unknown sample [%s]", sampleId));
        });
        return app2;
      })(),
      branches: branches
    };
  };

  if (sandboxConfig.enabled !== false && webweaverService.hasPortlet(targetPortlet)) {
    const portlet = webweaverService.getPortlet(targetPortlet);
    portlet.push([
      portlet.getDefaultRedirectLayer(),
      getLayer1([
        portlet.getSessionLayer([
          getLayer2()
        ])
      ])
    ], 500);
  }

  debugx.enabled && debugx(" - constructor end!");
};

Service.referenceList = [ "webweaverService" ];

module.exports = Service;
