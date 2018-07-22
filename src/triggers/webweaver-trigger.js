'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

function WebweaverTrigger(params) {
  params = params || {};
  let self = this;

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-webweaver';
  let blockRef = chores.getBlockRef(__filename, packageName);

  self.start = function() {
    LX.has('silly') && LX.log('silly', LT.add({ blockRef }).toMessage({
      tags: [ blockRef, 'trigger-starting' ],
      text: ' - trigger[${blockRef}] is starting'
    }));
    return Promise.resolve(params.webweaverService.combine());
  };

  self.stop = function() {
    LX.has('silly') && LX.log('silly', LT.add({ blockRef }).toMessage({
      tags: [ blockRef, 'trigger-stopping' ],
      text: ' - trigger[${blockRef}] is stopping'
    }));
    return Promise.resolve();
  };
};

WebweaverTrigger.referenceList = [ "webweaverService" ];

module.exports = WebweaverTrigger;
