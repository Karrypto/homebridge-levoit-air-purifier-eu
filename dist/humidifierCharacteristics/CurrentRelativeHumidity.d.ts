import { CharacteristicGetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncHumAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=CurrentRelativeHumidity.d.ts.map