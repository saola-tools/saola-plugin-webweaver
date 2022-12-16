'use strict';

/**
 * Để test wireLayer, chúng ta cần xác định các biến phụ thuộc từ bên ngoài như sau:
 * - Function express
 * - LX
 * - LT
 * - blockRef
 * - 
 */

const devebot = require('devebot');
const lodash = devebot.require('lodash');
const assert = require('liberica').assert;
const mockit = require('liberica').mockit;
const sinon = require('liberica').sinon;
const path = require('path');

const express = require('express');
const expressListRoutes = require('express-list-routes');
const expressListEndpoints = require('express-list-endpoints');

describe.skip('builder', function() {

  describe('wire()', function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      LX: loggingFactory.getLogger(),
      LT: loggingFactory.getTracer(),
      blockRef: 'app-webweaver/wire',
      express,
    }

    let Constructor, wire;

    beforeEach(function() {
      Constructor = mockit.acquire('webweaver-service', { libraryDir: '../src' });
      wire = mockit.get(Constructor, 'wire');
    });

    it('case #1', function() {
      assert.isFunction(wire);
      const slot = wire(ctx);
      const routers = expressListRoutes(slot);
      console.log(routers);
    });

    it('case #2', function() {
      const trails = [];
      const layer = {
        name: 'printRequestInfo',
        path: "/api/v1",
        middleware: function(req, res, next) {
          next();
        }
      };
      const slot = wire(ctx, express(), layer, trails);

      function print (path, layer) {
        if (layer.route) {
          layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
        } else if (layer.name === 'router' && layer.handle.stack) {
          layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
        } else if (layer.method) {
          console.log('%s /%s',
            layer.method.toUpperCase(),
            path.concat(split(layer.regexp)).filter(Boolean).join('/'))
        }
      }
      
      function split (thing) {
        if (typeof thing === 'string') {
          return thing.split('/')
        } else if (thing.fast_slash) {
          return ''
        } else {
          var match = thing.toString()
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '$')
            .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
          return match
            ? match[1].replace(/\\(.)/g, '$1').split('/')
            : '<complex:' + thing.toString() + '>'
        }
      }
      
      // slot._router.stack.forEach(print.bind(null, []))
      //
      // const routers = expressListRoutes(slot, {
      //   prefix: "/api",
      //   logger: console.info
      // });
      // console.log(expressListEndpoints(slot));
      // console.log(slot);
      slot._router.stack.forEach(function(middleware){
        console.log(middleware.path);
        // if(middleware.route){ // routes registered directly on the app
        //     routes.push(middleware.route);
        // } else if(middleware.name === 'router'){ // router middleware 
        //     middleware.handle.stack.forEach(function(handler){
        //         route = handler.route;
        //         route && routes.push(route);
        //     });
        // }
      });
    });
  });
});

function RequestMock (defs = {}) {
  const store = { };

  store.headers = lodash.mapKeys(defs.headers, function(value, key) {
    return lodash.lowerCase(key);
  });

  this.get = function(name) {
    return store.headers[lodash.lowerCase(name)];
  }
}

function ResponseMock (defs = {}) {
  this.set = sinon.stub();
  this.status = sinon.stub();
  this.text = sinon.stub();
  this.json = sinon.stub();
  this.end = sinon.stub();
}
