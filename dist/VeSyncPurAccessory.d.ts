import { Characteristic, Service } from 'homebridge';
import Platform, { AdditionalAccessories, VeSyncPlatformAccessory } from './platform';
import VeSyncFan from './api/VeSyncFan';
export type AccessoryThisType = ThisType<{
    airPurifierActiveCharacteristic?: Characteristic;
    airPurifierCurrentCharacteristic?: Characteristic;
    airPurifierRotationSpeedCharacteristic?: Characteristic;
    airPurifierTargetCharacteristic?: Characteristic;
    HomeAirQuality: VeSyncPurAccessory['HomeAirQuality'];
    airPurifierService: Service;
    platform: Platform;
    device: VeSyncFan;
}>;
export default class VeSyncPurAccessory {
    private readonly platform;
    private readonly accessory;
    readonly additional: AdditionalAccessories;
    private HomeAirQuality;
    airPurifierActiveCharacteristic?: Characteristic;
    airPurifierCurrentCharacteristic?: Characteristic;
    airPurifierRotationSpeedCharacteristic?: Characteristic;
    airPurifierTargetCharacteristic?: Characteristic;
    private airPurifierService?;
    get UUID(): string;
    refreshState(): Promise<void>;
    private get device();
    constructor(platform: Platform, accessory: VeSyncPlatformAccessory, additional: AdditionalAccessories);
}
//# sourceMappingURL=VeSyncPurAccessory.d.ts.map