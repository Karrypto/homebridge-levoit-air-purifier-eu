import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '../VeSyncPurAccessory';
import { assertCommandSuccess, delay } from '../util';
import {
  getPurifierRotationSpeed,
  updatePurifierPowerState
} from './airPurifierState';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();

    return this.device.isOn ? 1 : 0;
  },
  set: async function (value: CharacteristicValue) {
    const boolValue = value === 1;

    if (boolValue !== this.device.isOn) {
      const success = await this.device.setPower(boolValue);
      assertCommandSuccess(success, 'Set purifier power');
    } else {
      await delay(10);
    }

    updatePurifierPowerState(
      this,
      boolValue,
      boolValue ? getPurifierRotationSpeed(this.device) : 0
    );
  }
};

export default characteristic;
