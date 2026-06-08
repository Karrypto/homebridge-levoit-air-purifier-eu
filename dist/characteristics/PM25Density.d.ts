import { CharacteristicGetHandler } from 'homebridge';
import { AccessoryThisType } from '../VeSyncPurAccessory';
declare const characteristic: {
    get: CharacteristicGetHandler;
} & AccessoryThisType;
export default characteristic;
//# sourceMappingURL=PM25Density.d.ts.map