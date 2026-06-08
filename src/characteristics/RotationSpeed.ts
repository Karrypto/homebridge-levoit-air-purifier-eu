import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { Mode } from '../api/VeSyncFan';
import { AccessoryThisType } from '../VeSyncPurAccessory';
import { assertCommandSuccess, normalizeSteppedPercentage } from '../util';
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

    return getPurifierRotationSpeed(this.device);
  },
  set: async function (value: CharacteristicValue) {
    const targetLevel = normalizeSteppedPercentage(
      value,
      this.device.deviceType.speedMinStep
    );

    if (targetLevel === 0) {
      if (this.device.isOn) {
        const success = await this.device.setPower(false);
        assertCommandSuccess(success, 'Set purifier power');
      }

      updatePurifierPowerState(this, false);
      return;
    }

    if (!this.device.isOn) {
      await this.device.updateInfo(true);
    }

    const currentLevel = Math.round(
      getPurifierRotationSpeed(this.device) / this.device.deviceType.speedMinStep
    );

    if (!this.device.isOn) {
      const success = await this.device.setPower(true);
      assertCommandSuccess(success, 'Set purifier power');
      updatePurifierPowerState(this, true, targetLevel * this.device.deviceType.speedMinStep);
    }

    if (targetLevel === currentLevel && this.device.mode === Mode.Manual) {
      return;
    }

    if (targetLevel === 1) {
      const success = await this.device.changeMode(Mode.Sleep);
      assertCommandSuccess(success, 'Set purifier sleep mode');
      this.airPurifierTargetCharacteristic?.updateValue(
        this.platform.Characteristic.TargetAirPurifierState.MANUAL
      );
      this.airPurifierRotationSpeedCharacteristic?.updateValue(
        this.device.deviceType.speedMinStep
      );
    } else {
      const success = await this.device.changeSpeed(targetLevel - 1);
      assertCommandSuccess(success, 'Set purifier speed');
      this.airPurifierTargetCharacteristic?.updateValue(
        this.platform.Characteristic.TargetAirPurifierState.MANUAL
      );
      this.airPurifierRotationSpeedCharacteristic?.updateValue(
        targetLevel * this.device.deviceType.speedMinStep
      );
    }
  }
};

export default characteristic;
