'use strict';

const app = require('../app/example');

describe('appWeaver:test:bdd:middleware:', function() {
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
