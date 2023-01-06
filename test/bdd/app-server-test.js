"use strict";

const Devebot = require("devebot");
const chores = Devebot.require("chores");

const app = require("../app/simplest");

describe("appWeaver", function() {
  describe("start/stop app engine-service", function() {
    before(function() {
      chores.setEnvironments({
        DEVEBOT_FORCING_SILENT: "devebot,webserver",
        LOGOLITE_FULL_LOG_MODE: "false",
        LOGOLITE_ALWAYS_ENABLED: "all",
        LOGOLITE_ALWAYS_MUTED: "all"
      });
    });
    //
    after(function() {
      chores.clearCache();
    });
    //
    it("engine-service should be started/stopped properly", function() {
      return app.server.start().then(function() {
        return app.server.stop();
      });
    });
  });
});
