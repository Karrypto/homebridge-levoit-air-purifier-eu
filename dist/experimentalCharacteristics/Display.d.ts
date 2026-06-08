import { CharacteristicGetHandler, CharacteristicSetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncPurAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
    set: CharacteristicSetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=Display.d.ts.map