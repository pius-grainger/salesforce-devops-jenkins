import { Hook } from '@oclif/core';

const hook: Hook<'init'> = async function () {
  // Plugin initialization hook
  // Add any setup logic needed when the plugin loads
  this.debug('sf-ui-automation plugin initialized');
};

export default hook;
