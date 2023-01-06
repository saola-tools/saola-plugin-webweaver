"use strict";

const Devebot = require("devebot");
const chores = Devebot.require("chores");

function WebweaverTrigger (params) {
  params = params || {};

  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const packageName = params.packageName || "app-webweaver";
  const blockRef = chores.getBlockRef(__filename, packageName);

  this.start = function() {
    L && L.has("silly") && L.log("silly", T && T.add({ blockRef }).toMessage({
      tags: [ blockRef, "trigger-starting" ],
      text: " - trigger[${blockRef}] is starting"
    }));
    return Promise.resolve(params.webweaverService.combine());
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
