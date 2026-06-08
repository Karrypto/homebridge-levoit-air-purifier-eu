import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';
import { Mode } from '../api/VeSyncFan';

import { AccessoryThisType } from '../VeSyncPurAccessory';
import { assertCommandSuccess } from '../util';
import {
  getPurifierRotationSpeed,
  updatePurifierPowerState
} from './airPurifierState';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    const { MANUAL, AUTO } =
      this.platform.Characteristic.TargetAirPurifierState;

    if (!this.device.deviceType.hasAutoMode) {
      return MANUAL;
    }

    await this.device.updateInfo();

    return this.device.mode === Mode.Auto ? AUTO : MANUAL;
  },
  set: async function (value: CharacteristicValue) {
    if (!this.device.deviceType.hasAutoMode) {
      return;
    }

    const { MANUAL, AUTO } =
      this.platform.Characteristic.TargetAirPurifierState;
    let mode: Mode | undefined;
    let action: string | undefined;

    switch (value) {
      case AUTO:
        mode = Mode.Auto;
        action = 'Set purifier auto mode';
        break;
      case MANUAL:
        mode = Mode.Manual;
        action = 'Set purifier manual mode';
        break;
    }

    if (!mode || !action) {
      return;
    }

    const shouldUpdatePowerState = !this.device.isOn;

    if (shouldUpdatePowerState) {
      const success = await this.device.setPower(true);
      assertCommandSuccess(success, 'Set purifier power');
    }

    if (this.device.mode !== mode) {
      const success = await this.device.changeMode(mode);
      assertCommandSuccess(success, action);
    }

    this.airPurifierTargetCharacteristic?.updateValue(value);

    if (shouldUpdatePowerState) {
      updatePurifierPowerState(this, true, getPurifierRotationSpeed(this.device));
    }
  }
};

export default characteristic;
