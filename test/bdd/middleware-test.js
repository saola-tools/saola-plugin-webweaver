'use strict';

const app = require('../app');
const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');
const debug = Devebot.require('debug');
const assert = require('chai').assert;
const expect = require('chai').expect;
const util = require('util');
const debugx = debug('appWeaver:test:bdd:middleware');

describe('appWeaver:test:bdd:middleware:', function() {
	describe('start/stop app engine-service', function() {
		it('engine-service should be started/stopped properly', function(done) {
			app.server.start().then(function() {
				return app.server.teardown();
			}).then(function() {
				done();
			});
			this.timeout(6000);
		});
	});
});
