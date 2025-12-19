import { Characteristic, Service } from 'homebridge';
import Platform, { VeSyncAdditionalType, VeSyncPlatformAccessory } from './platform';
import VeSyncFan from './api/VeSyncFan';
export type AccessoryThisType = ThisType<{
    airPurifierCurrentCharacteristic?: Characteristic;
    HomeAirQuality: VeSyncPurAccessory['HomeAirQuality'];
    airPurifierService: Service;
    platform: Platform;
    device: VeSyncFan;
}>;
export default class VeSyncPurAccessory {
    private readonly platform;
    private readonly accessory;
    readonly additional: Record<VeSyncAdditionalType, VeSyncPlatformAccessory | undefined>;
    private HomeAirQuality;
    private airPurifierCurrentCharacteristic?;
    private airPurifierService?;
    get UUID(): string;
    private get device();
    constructor(platform: Platform, accessory: VeSyncPlatformAccessory, additional: Record<VeSyncAdditionalType, VeSyncPlatformAccessory | undefined>);
}
//# sourceMappingURL=VeSyncPurAccessory.d.ts.map