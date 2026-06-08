import type { Characteristic } from 'homebridge';

import type VeSyncFan from '../api/VeSyncFan';
import { Mode } from '../api/VeSyncFan';
import type Platform from '../platform';

export type AirPurifierStateContext = {
  airPurifierActiveCharacteristic?: Characteristic;
  airPurifierCurrentCharacteristic?: Characteristic;
  airPurifierRotationSpeedCharacteristic?: Characteristic;
  platform: Platform;
};

export const getPurifierRotationSpeed = (device: VeSyncFan) => {
  let speed = (device.speed + 1) * device.deviceType.speedMinStep;
  if (device.mode === Mode.Sleep) {
    speed = device.deviceType.speedMinStep;
  } else if (device.mode === Mode.Auto && device.speed <= 1) {
    speed = device.deviceType.speedMinStep;
  }

  return device.isOn ? speed : 0;
};

export const updatePurifierPowerState = (
  context: AirPurifierStateContext,
  isOn: boolean,
  rotationSpeed?: number
) => {
  context.airPurifierActiveCharacteristic?.updateValue(
    isOn
      ? context.platform.Characteristic.Active.ACTIVE
      : context.platform.Characteristic.Active.INACTIVE
  );

  context.airPurifierCurrentCharacteristic?.updateValue(
    isOn
      ? context.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
      : context.platform.Characteristic.CurrentAirPurifierState.INACTIVE
  );

  if (!isOn || rotationSpeed !== undefined) {
    context.airPurifierRotationSpeedCharacteristic?.updateValue(
      isOn ? (rotationSpeed ?? 0) : 0
    );
  }
};
