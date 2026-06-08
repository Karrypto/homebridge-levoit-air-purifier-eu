import { CharacteristicGetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncPurAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=CurrentState.d.ts.map