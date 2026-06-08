import { CharacteristicGetHandler, CharacteristicSetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncHumAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
    set: CharacteristicSetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=AutoMode.d.ts.map