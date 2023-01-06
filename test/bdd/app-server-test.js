'use strict';

const app = require('../app/simplest');

describe('appWeaver', function() {
  describe('start/stop app engine-service', function() {
    it('engine-service should be started/stopped properly', function() {
      return app.server.start().then(function() {
        return app.server.stop();
      });
    });
  });
});
