import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '../VeSyncPurAccessory';
import { assertCommandSuccess, delay } from '../util';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();

    return this.device.screenVisible;
  },
  set: async function (value: CharacteristicValue) {
    const boolValue = value as boolean;

    if (boolValue !== this.device.screenVisible) {
      const success = await this.device.setDisplay(boolValue);
      assertCommandSuccess(success, 'Set display');
    } else {
      await delay(10);
    }
  }
};

export default characteristic;
