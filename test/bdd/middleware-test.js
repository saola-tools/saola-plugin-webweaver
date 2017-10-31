'use strict';

var app = require('../app');
var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var debugx = debug('appWeaver:test:bdd:middleware');

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
