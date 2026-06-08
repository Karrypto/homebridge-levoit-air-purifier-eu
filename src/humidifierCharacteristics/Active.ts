import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '../VeSyncHumAccessory';
import { assertCommandSuccess, delay } from '../util';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();
    return this.device.isOn;
  },
  set: async function (value: CharacteristicValue) {
    const boolValue = value === 1;

    if (boolValue !== this.device.isOn) {
      const success = await this.device.setPower(boolValue);
      assertCommandSuccess(success, 'Set humidifier power');
    } else {
      await delay(10);
    }

    this.currentStateChar?.updateValue(
      this.device.currentState,
    );
  }
};

export default characteristic;
