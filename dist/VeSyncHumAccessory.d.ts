import { Characteristic, Service } from 'homebridge';
import Platform, { VeSyncPlatformAccessory } from './platform';
import VeSyncHumidifier from './api/VeSyncHumidifier';
export type AccessoryThisType = ThisType<{
    currentStateChar?: Characteristic;
    humidifierService: Service;
    modeChar?: Characteristic;
    device: VeSyncHumidifier;
    platform: Platform;
}>;
export default class VeSyncHumAccessory {
    private readonly platform;
    private readonly accessory;
    private currentStateChar?;
    private modeChar?;
    private humidifierService?;
    get UUID(): string;
    private get device();
    constructor(platform: Platform, accessory: VeSyncPlatformAccessory);
}
//# sourceMappingURL=VeSyncHumAccessory.d.ts.map