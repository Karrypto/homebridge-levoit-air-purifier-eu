import { Logger } from 'homebridge';
import VeSyncHumidifier from './VeSyncHumidifier';
import { VeSyncGeneric } from './VeSyncGeneric';
import DebugMode from '../debugMode';
import VeSyncFan from './VeSyncFan';
export declare enum BypassMethod {
    STATUS = "getPurifierStatus",
    MODE = "setPurifierMode",
    NIGHT = "setNightLight",
    DISPLAY = "setDisplay",
    LOCK = "setChildLock",
    SWITCH = "setSwitch",
    SPEED = "setLevel"
}
export declare enum HumidifierBypassMethod {
    HUMIDITY = "setTargetHumidity",
    STATUS = "getHumidifierStatus",
    MIST_LEVEL = "setVirtualLevel",
    MODE = "setHumidityMode",
    DISPLAY = "setDisplay",
    SWITCH = "setSwitch",
    LEVEL = "setLevel"
}
export interface VeSyncClientOptions {
    /** Override für die VeSync App-Version (Server-Gatekeeping). */
    appVersion?: string;
    /** Stabile Device-ID / devToken (einige Backends verlangen das beim Login). */
    deviceId?: string;
    /** Country Code (wichtig für internationale Accounts; EU-Accounts laufen i. d. R. über smartapi.vesync.eu). */
    countryCode?: string;
    /** Optional: Endpoint override, z.B. https://smartapi.vesync.eu */
    baseURL?: string;
}
export default class VeSync {
    private readonly email;
    private readonly password;
    readonly debugMode: DebugMode;
    readonly log: Logger;
    private readonly options;
    private api?;
    private accountId?;
    private token?;
    private loginInterval?;
    private readonly APP_VERSION;
    private readonly DEVICE_ID;
    private readonly COUNTRY_CODE;
    private baseURL;
    private readonly AGENT;
    private readonly TIMEZONE;
    private readonly OS;
    private readonly LANG;
    private get AXIOS_OPTIONS();
    constructor(email: string, password: string, debugMode: DebugMode, log: Logger, options?: VeSyncClientOptions);
    private isEuCountryCode;
    private getAlternateBaseURL;
    private generateDetailBody;
    private generateBody;
    private generateV2Body;
    sendCommand(fan: VeSyncGeneric, method: BypassMethod | HumidifierBypassMethod, body?: {}): Promise<boolean>;
    getDeviceInfo(fan: VeSyncGeneric, humidifier?: boolean): Promise<any>;
    startSession(): Promise<boolean>;
    stopSession(): void;
    private login;
    /**
     * Login ohne Lock.acquire – nur aufrufen, wenn das Lock bereits gehalten wird.
     * (Wichtig, um Deadlocks bei Token-Refresh innerhalb anderer API-Calls zu vermeiden.)
     */
    private loginInternal;
    getDevices(): Promise<{
        purifiers: VeSyncFan[];
        humidifiers: VeSyncHumidifier[];
    }>;
}
//# sourceMappingURL=VeSync.d.ts.map