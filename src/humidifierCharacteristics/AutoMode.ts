import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '../VeSyncHumAccessory';
import { Mode } from '../api/VeSyncHumidifier';
import { assertCommandSuccess } from '../util';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();
    return this.device.mode === Mode.Auto ? 1 : 0;
  },
  set: async function (value: CharacteristicValue) {
    const mode = value === 1 ? Mode.Auto : Mode.Manual;
    if (mode !== this.device.mode) {
      const success = await this.device.setMode(mode);
      assertCommandSuccess(success, 'Set humidifier mode');
    }
  }
};

export default characteristic;
