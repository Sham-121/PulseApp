import { NativeModules, NativeEventEmitter } from 'react-native';

const { PulseModule } = NativeModules;

if (!PulseModule) {
  console.error('PulseModule is not available. Make sure native module is linked.');
}

const emitter = PulseModule ? new NativeEventEmitter(PulseModule) : null;

export default {
  startScan: (durationSec = 20) => {
    if (!PulseModule || !PulseModule.startScan) {
      return Promise.reject(new Error('PulseModule not available'));
    }
    return PulseModule.startScan(durationSec);
  },
  stopScan: () => {
    if (!PulseModule || !PulseModule.stopScan) return Promise.resolve(false);
    return PulseModule.stopScan();
  },
  addListener: (eventName, cb) => {
    if (!emitter) return { remove: () => {} };
    return emitter.addListener(eventName, cb);
  },
};