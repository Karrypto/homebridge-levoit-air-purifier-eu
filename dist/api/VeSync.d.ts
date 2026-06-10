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
export declare const DEFAULT_DEVICE_REFRESH_INTERVAL_MS: number;
export declare const MIN_DEVICE_REFRESH_INTERVAL_MS: number;
export declare const MAX_DEVICE_REFRESH_INTERVAL_MS: number;
export interface VeSyncClientOptions {
    countryCode?: string;
    refreshInterval?: number;
    storagePath?: string;
}
export declare function resolveBaseURLForCountry(countryCode?: string): "https://smartapi.vesync.com" | "https://smartapi.vesync.eu";
export declare function normalizeRefreshIntervalMs(value?: number): number;
export declare function createSessionOwnerHash(email: string, countryCode: string): string;
export declare const isValidSessionAppId: (value: unknown) => boolean;
export declare const isValidSessionTerminalId: (value: unknown) => boolean;
export default class VeSync {
    private readonly email;
    private readonly password;
    readonly debugMode: DebugMode;
    readonly log: Logger;
    private readonly options;
    private api?;
    private accountId?;
    private token?;
    private tokenExpiresAt?;
    private loginInterval?;
    private readonly unsupportedDeviceKeys;
    private quotaPausedUntil;
    private quotaWarningLogged;
    private deviceListCache?;
    private deviceListRequest?;
    private terminalId?;
    private appId?;
    private readonly APP_VERSION;
    private readonly CLIENT_VERSION;
    private readonly COUNTRY_CODE;
    private readonly sessionOwnerHash;
    private baseURL;
    private readonly AGENT;
    private readonly TIMEZONE;
    private readonly OS;
    private readonly LANG;
    private readonly PHONE_BRAND;
    private readonly CLIENT_INFO;
    readonly deviceUpdateIntervalMs: number;
    private readonly sessionFilePath?;
    private get axiosOptions();
    constructor(email: string, password: string, debugMode: DebugMode, log: Logger, options?: VeSyncClientOptions);
    private getAlternateBaseURL;
    private createAuthenticatedApiClient;
    private requireApiClient;
    private isQuotaPaused;
    private markQuotaExceeded;
    private handleQuotaResponse;
    private clearQuotaPause;
    private loadPersistedSession;
    private loadPersistedDeviceIds;
    private isValidPersistedSession;
    private saveSession;
    private clearPersistedSession;
    private refreshSessionForExpiredToken;
    private generateDetailBody;
    private generateBody;
    private generateV2Body;
    sendCommand(fan: VeSyncGeneric, method: BypassMethod | HumidifierBypassMethod, body?: {}): Promise<boolean>;
    getDeviceInfo(fan: VeSyncGeneric, humidifier?: boolean): Promise<any>;
    startSession(): Promise<boolean>;
    stopSession(): void;
    private login;
    private loginInternal;
    private loginLegacy;
    private fetchDeviceList;
    private requestDeviceList;
    getDeviceSnapshot(fan: VeSyncGeneric): Promise<any | null>;
    getDevices(): Promise<{
        purifiers: VeSyncFan[];
        humidifiers: VeSyncHumidifier[];
    }>;
    private logUnsupportedDevices;
}
//# sourceMappingURL=VeSync.d.ts.map