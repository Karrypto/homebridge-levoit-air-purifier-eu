import { DynamicPlatformPlugin, PlatformAccessory, PlatformConfig, Characteristic, Service, Logger, API } from 'homebridge';
import VeSyncPurAccessory from './VeSyncPurAccessory';
import VeSyncHumAccessory from './VeSyncHumAccessory';
import VeSyncHumidifier from './api/VeSyncHumidifier';
import { ExperimentalFeatures } from './types';
import VeSyncFan from './api/VeSyncFan';
import DebugMode from './debugMode';
export interface VeSyncContext {
    name: string;
    device: VeSyncFan | VeSyncHumidifier;
}
export declare enum VeSyncAdditionalType {
    Sensor = 0,
    Light = 1
}
export interface VeSyncAdditionalContext {
    name: string;
    parent: string;
    type: VeSyncAdditionalType;
}
export type VeSyncPlatformAccessory = PlatformAccessory<VeSyncContext | VeSyncAdditionalContext>;
export type AdditionalAccessories = Partial<Record<VeSyncAdditionalType, VeSyncPlatformAccessory>>;
export interface Config extends PlatformConfig {
    experimentalFeatures: ExperimentalFeatures[];
    enableDebugMode?: boolean;
    excludeDevices?: string[];
    includeDevices?: string[];
    countryCode?: string;
    rediscoveryInterval?: number;
    refreshInterval?: number;
    password: string;
    email: string;
}
export default class Platform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: Config;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly registeredDevices: (VeSyncPurAccessory | VeSyncHumAccessory)[];
    readonly cachedAccessories: VeSyncPlatformAccessory[];
    readonly cachedAdditional: VeSyncPlatformAccessory[];
    readonly debugger: DebugMode;
    private readonly client?;
    private readonly excludeDevices;
    private readonly includeDevices;
    private readonly rediscoveryIntervalMs;
    private discoveryInProgress;
    private rediscoveryTimer?;
    private statusRefreshInProgress;
    private statusRefreshTimer?;
    private readonly missingCachedAccessoryCounts;
    constructor(log: Logger, config: Config, api: API);
    configureAccessory(accessory: VeSyncPlatformAccessory): void;
    private cleanAccessories;
    private discoverDevices;
    private startRediscovery;
    private stopRediscovery;
    private startStatusRefresh;
    private stopStatusRefresh;
    private refreshDeviceStates;
    private shouldLoadDevice;
    private loadDevice;
    private createDeviceAccessory;
    private checkOldDevices;
    private loadAdditional;
    private syncAdditionalAccessory;
}
//# sourceMappingURL=platform.d.ts.map