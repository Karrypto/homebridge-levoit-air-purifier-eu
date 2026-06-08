import type { Characteristic } from 'homebridge';
import type VeSyncFan from '../api/VeSyncFan';
import type Platform from '../platform';
export type AirPurifierStateContext = {
    airPurifierActiveCharacteristic?: Characteristic;
    airPurifierCurrentCharacteristic?: Characteristic;
    airPurifierRotationSpeedCharacteristic?: Characteristic;
    platform: Platform;
};
export declare const getPurifierRotationSpeed: (device: VeSyncFan) => number;
export declare const updatePurifierPowerState: (context: AirPurifierStateContext, isOn: boolean, rotationSpeed?: number) => void;
//# sourceMappingURL=airPurifierState.d.ts.map