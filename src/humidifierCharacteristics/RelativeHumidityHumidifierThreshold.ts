import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '../VeSyncHumAccessory';
import { assertCommandSuccess, clamp } from '../util';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();
    return this.device.targetHumidity;
  },
  set: async function (value: CharacteristicValue) {
    const newTarget = clamp(value as number, 30, 80);

    if (newTarget !== this.device.targetHumidity) {
      const success = await this.device.setTarget(newTarget);
      assertCommandSuccess(success, 'Set target humidity');
    }
  }
};

export default characteristic;
