"use strict";

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");

function WebweaverTrigger (params) {
  const { packageName, loggingFactory, webweaverService } = params || {};

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName || "app-webweaver");

  this.start = function() {
    L && L.has("silly") && L.log("silly", T && T.add({ blockRef }).toMessage({
      tags: [ blockRef, "trigger-starting" ],
      text: " - trigger[${blockRef}] is starting"
    }));
    return Promise.resolve(webweaverService.combine());
  };

  this.stop = function() {
    L && L.has("silly") && L.log("silly", T && T.add({ blockRef }).toMessage({
      tags: [ blockRef, "trigger-stopping" ],
      text: " - trigger[${blockRef}] is stopping"
    }));
    return Promise.resolve();
  };
};

WebweaverTrigger.referenceHash = {
  webweaverService: "webweaverService"
};

module.exports = WebweaverTrigger;
