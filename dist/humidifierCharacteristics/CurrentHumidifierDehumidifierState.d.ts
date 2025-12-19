import { CharacteristicGetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncHumAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=CurrentHumidifierDehumidifierState.d.ts.map