import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import VeSyncHumidifier from '../api/VeSyncHumidifier';
import { AccessoryThisType } from '../VeSyncHumAccessory';
import { assertCommandSuccess, delay, normalizeSteppedPercentage } from '../util';

const calculateSpeed = (device: VeSyncHumidifier) => {
  const speed = (device.speed) * device.deviceType.speedMinStep;
  return device.isOn ? speed : 0;
};

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.device.updateInfo();
    return calculateSpeed(this.device);
  },
  set: async function (value: CharacteristicValue) {
    const targetLevel = normalizeSteppedPercentage(
      value,
      this.device.deviceType.speedMinStep
    );

    if (targetLevel === 0) {
      if (this.device.isOn) {
        const success = await this.device.setPower(false);
        assertCommandSuccess(success, 'Set humidifier power');
      }

      this.currentStateChar?.updateValue(this.device.currentState);
      return;
    }

    if (!this.device.isOn) {
      const success = await this.device.setPower(true);
      assertCommandSuccess(success, 'Set humidifier power');
      this.currentStateChar?.updateValue(this.device.currentState);
    }

    if (targetLevel === this.device.speed) {
      return;
    }

    const success = await this.device.setSpeed(targetLevel);
    assertCommandSuccess(success, 'Set humidifier speed');

    if (success && this.modeChar) {
      await delay(10);
      this.modeChar.updateValue(0);
    }
  }
};

export default characteristic;
