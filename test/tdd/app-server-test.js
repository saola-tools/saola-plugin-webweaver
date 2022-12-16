'use strict';

const app = require('../../server');

describe('appWeaver', function() {
  describe('start/stop app engine-service', function() {
    it('engine-service should be started/stopped properly', function(done) {
      app.server.start().then(function() {
        return app.server.stop();
      }).then(function() {
        done();
      });
      this.timeout(6000);
    });
  });
});
