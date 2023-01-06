"use strict";

const axios = require("axios");
const { assert } = require("liberica");

const Devebot = require("devebot");
const chores = Devebot.require("chores");

const app = require("../app/simplest");
const example = require("../app/example");

describe("app-webweaver", function() {
  describe("server-life-cycle", function() {
    before(function() {
      chores.setEnvironments({
        DEVEBOT_FORCING_SILENT: "devebot,webweaver",
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
    it("Request and response smoothly", function() {
      const expected = {
        "message": "example [B7ED788C-E130-460C-9D3E-2CCF8B0EEADA] request successfully"
      };
      //
      return example.server.start()
        .then(function() {
          return axios.request({
            url: "http://localhost:7979/example/B7ED788C-E130-460C-9D3E-2CCF8B0EEADA",
            method: "GET",
            headers: {"Content-Type": "application/json"},
            data: undefined,
            responseType: "json",
          });
        })
        .then(function(resp) {
          assert.equal(resp.status, 200);
          false && console.log(JSON.stringify(resp.data, null, 2));
          assert.deepEqual(resp.data, expected);
        })
        .catch(function(err) {
          true && console.log(err);
          assert.fail("This testcase must complete successfully");
        })
        .finally(function() {
          return example.server.stop();
        });
    });
    //
    it("raise a [EADDRINUSE] error if the port already in use", function() {
      return example.server.start()
        .then(function() {
          return app.server.start()
            .then(function() {
              assert.fail("This testcase must raise an error");
            })
            .catch(function(err) {
              assert.instanceOf(err, Error);
              assert.equal(err.code, "EADDRINUSE");
              assert.equal(err.message, "listen EADDRINUSE: address already in use 0.0.0.0:7979");
            });
        })
        .finally(function() {
          return example.server.stop();
        });
    });
  });
});
