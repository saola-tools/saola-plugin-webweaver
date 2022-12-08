'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');

function WebweaverTrigger(params) {
  params = params || {};
  const self = this;

  const LX = params.loggingFactory.getLogger();
  const LT = params.loggingFactory.getTracer();
  const packageName = params.packageName || 'app-webweaver';
  const blockRef = chores.getBlockRef(__filename, packageName);

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
