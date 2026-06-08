import axios, { AxiosInstance } from 'axios';
import { Logger } from 'homebridge';
import AsyncLock from 'async-lock';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import deviceTypes, { humidifierDeviceTypes } from './deviceTypes';
import VeSyncHumidifier from './VeSyncHumidifier';
import { VeSyncGeneric } from './VeSyncGeneric';
import DebugMode from '../debugMode';
import VeSyncFan from './VeSyncFan';
import { clamp, delay } from '../util';

export enum BypassMethod {
  STATUS = 'getPurifierStatus',
  MODE = 'setPurifierMode',
  NIGHT = 'setNightLight',
  DISPLAY = 'setDisplay',
  LOCK = 'setChildLock',
  SWITCH = 'setSwitch',
  SPEED = 'setLevel'
}

export enum HumidifierBypassMethod {
  HUMIDITY = 'setTargetHumidity',
  STATUS = 'getHumidifierStatus',
  MIST_LEVEL = 'setVirtualLevel',
  MODE = 'setHumidityMode',
  DISPLAY = 'setDisplay',
  SWITCH = 'setSwitch',
  LEVEL = 'setLevel',
}

const lock = new AsyncLock();
const VESYNC_API_BASE_URL = 'https://smartapi.vesync.com';
const VESYNC_EU_API_BASE_URL = 'https://smartapi.vesync.eu';
const ALLOWED_BASE_URLS = new Set([
  VESYNC_API_BASE_URL,
  VESYNC_EU_API_BASE_URL
]);
const APP_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TERMINAL_ID_CHARS = 'abcdef0123456789';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const TERMINAL_ID_PATTERN = /^[a-f0-9]{16}$/;
const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const SESSION_REFRESH_MS = 55 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const DEFAULT_DEVICE_REFRESH_INTERVAL_MS = 5 * 1000;
export const MIN_DEVICE_REFRESH_INTERVAL_MS = 5 * 1000;
export const MAX_DEVICE_REFRESH_INTERVAL_MS = 300 * 1000;
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
  'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
  'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'IS', 'LI', 'CH'
]);

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  retryableErrors?: number[]
): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const statusCode = error?.response?.status;
      const errorCode = error?.response?.data?.code;
      
      const isRetryable = 
        statusCode === 429 ||
        statusCode === 503 ||
        statusCode === 502 ||
        statusCode === 504 ||
        (statusCode >= 500 && statusCode < 600) ||
        (retryableErrors && retryableErrors.includes(errorCode)) ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ENOTFOUND';
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt);
      await delay(delayMs);
    }
  }
  throw lastError;
};

const isTokenInvalidCode = (code: unknown) =>
  code === -11012001 || code === -11012002;

const CROSS_REGION_ERROR_CODES = [-11260022, -11261022];
const CREDENTIAL_ERROR_CODES = [-11201129];
const REDACTED_LOG_KEYS = new Set([
  'accountid',
  'authorizecode',
  'biztoken',
  'devtoken',
  'email',
  'password',
  'tk',
  'token'
]);

export interface VeSyncClientOptions {
  countryCode?: string;
  refreshInterval?: number;
  storagePath?: string;
}

interface PersistedSession {
  ownerHash: string;
  countryCode: string;
  token: string;
  accountId: string;
  baseURL: string;
  expiresAt?: number;
  terminalId?: string;
  appId?: string;
}

function randomString(chars: string, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(chars.length));
  }
  return result;
}

function generateAppId(): string {
  return randomString(APP_ID_CHARS, 8);
}

function generateTerminalId(): string {
  return randomString(TERMINAL_ID_CHARS, 16);
}

export function resolveBaseURLForCountry(countryCode?: string) {
  return EU_COUNTRY_CODES.has((countryCode ?? 'US').toUpperCase())
    ? VESYNC_EU_API_BASE_URL
    : VESYNC_API_BASE_URL;
}

export function normalizeRefreshIntervalMs(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_DEVICE_REFRESH_INTERVAL_MS;
  }

  return clamp(
    Math.round(value) * 1000,
    MIN_DEVICE_REFRESH_INTERVAL_MS,
    MAX_DEVICE_REFRESH_INTERVAL_MS
  );
}

export function createSessionOwnerHash(email: string, countryCode: string) {
  return crypto
    .createHash('sha256')
    .update(`${email.trim().toLowerCase()}:${countryCode.toUpperCase()}`)
    .digest('hex');
}

export const isValidSessionAppId = (value: unknown) =>
  typeof value === 'string' && APP_ID_PATTERN.test(value);

export const isValidSessionTerminalId = (value: unknown) =>
  typeof value === 'string' && TERMINAL_ID_PATTERN.test(value);

function sanitizeForDebug(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForDebug);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      REDACTED_LOG_KEYS.has(key.toLowerCase()) ? '[redacted]' : sanitizeForDebug(entry)
    ])
  );
}

export default class VeSync {
  private api?: AxiosInstance;
  private accountId?: string;
  private token?: string;
  private tokenExpiresAt?: number;
  private loginInterval?: ReturnType<typeof setInterval>;
  private readonly unsupportedDeviceKeys = new Set<string>();
  
  private terminalId?: string;
  private appId?: string;

  private readonly APP_VERSION = '5.7.16';
  private readonly CLIENT_VERSION = `VeSync ${this.APP_VERSION}`;
  private readonly COUNTRY_CODE: string;
  private readonly sessionOwnerHash: string;
  private baseURL: string;
  private readonly AGENT = 'okhttp/3.12.1';
  private readonly TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  private readonly OS = 'Android';
  private readonly LANG = 'en';
  private readonly PHONE_BRAND = 'SM N9005';
  private readonly CLIENT_INFO = 'SM N9005';

  public readonly deviceUpdateIntervalMs: number;
  private readonly sessionFilePath?: string;

  private get axiosOptions() {
    return {
      baseURL: this.baseURL,
      timeout: 30000,
      maxBodyLength: 1024 * 1024,
      maxContentLength: 1024 * 1024,
      allowAbsoluteUrls: false
    };
  }

  constructor(
    private readonly email: string,
    private readonly password: string,
    public readonly debugMode: DebugMode,
    public readonly log: Logger,
    private readonly options: VeSyncClientOptions = {}
  ) {
    this.COUNTRY_CODE = (this.options.countryCode ?? 'US').toUpperCase();
    this.sessionOwnerHash = createSessionOwnerHash(this.email, this.COUNTRY_CODE);
    this.deviceUpdateIntervalMs = normalizeRefreshIntervalMs(this.options.refreshInterval);

    this.baseURL = resolveBaseURLForCountry(this.COUNTRY_CODE);

    if (this.options.storagePath) {
      this.sessionFilePath = path.join(this.options.storagePath, '.vesync-session.json');
    }
  }

  private getAlternateBaseURL() {
    return this.baseURL === VESYNC_EU_API_BASE_URL
      ? VESYNC_API_BASE_URL
      : VESYNC_EU_API_BASE_URL;
  }

  private createAuthenticatedApiClient(): AxiosInstance {
    if (!this.accountId || !this.token) {
      throw new Error('Cannot create VeSync API client without authentication');
    }

    return axios.create({
      ...this.axiosOptions,
      headers: {
        'content-type': 'application/json',
        'accept-language': this.LANG,
        accountid: this.accountId,
        'user-agent': this.AGENT,
        appversion: this.APP_VERSION,
        tz: this.TIMEZONE,
        tk: this.token
      }
    });
  }

  private requireApiClient(): AxiosInstance {
    if (!this.api) {
      throw new Error('The user is not logged in');
    }

    return this.api;
  }

  private loadPersistedSession(): PersistedSession | null {
    if (!this.sessionFilePath) return null;

    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const data = fs.readFileSync(this.sessionFilePath, 'utf8');
        const session: Partial<PersistedSession> = JSON.parse(data);

        this.loadPersistedDeviceIds(session);

        if (!this.isValidPersistedSession(session)) {
          this.debugMode.debug('[SESSION]', 'Ignoring invalid persisted session');
          this.clearPersistedSession();
          return null;
        }

        if (session.expiresAt && Date.now() > (session.expiresAt - SESSION_EXPIRY_BUFFER_MS)) {
          this.debugMode.debug('[SESSION]', 'Persisted session expired, will login fresh (keeping device IDs)');
          this.clearPersistedSession();
          return null;
        }

        this.debugMode.debug('[SESSION]', 'Loaded persisted session');
        return session;
      }
    } catch (error: any) {
      this.debugMode.debug('[SESSION]', 'Failed to load persisted session:', error?.message);
    }
    return null;
  }

  private loadPersistedDeviceIds(session: Partial<PersistedSession>) {
    if (isValidSessionTerminalId(session.terminalId)) {
      this.terminalId = session.terminalId;
    }

    if (isValidSessionAppId(session.appId)) {
      this.appId = session.appId;
    }
  }

  private isValidPersistedSession(session: Partial<PersistedSession>): session is PersistedSession {
    return (
      session.ownerHash === this.sessionOwnerHash &&
      session.countryCode === this.COUNTRY_CODE &&
      typeof session.token === 'string' &&
      session.token.length > 0 &&
      typeof session.accountId === 'string' &&
      session.accountId.length > 0 &&
      typeof session.baseURL === 'string' &&
      ALLOWED_BASE_URLS.has(session.baseURL) &&
      (session.expiresAt === undefined || typeof session.expiresAt === 'number') &&
      (session.terminalId === undefined || isValidSessionTerminalId(session.terminalId)) &&
      (session.appId === undefined || isValidSessionAppId(session.appId))
    );
  }

  private saveSession(): void {
    if (!this.sessionFilePath || !this.token || !this.accountId) return;

    try {
      const session: PersistedSession = {
        ownerHash: this.sessionOwnerHash,
        countryCode: this.COUNTRY_CODE,
        token: this.token,
        accountId: this.accountId,
        baseURL: this.baseURL,
        expiresAt: this.tokenExpiresAt,
        terminalId: this.terminalId,
        appId: this.appId
      };
      const tempFilePath = `${this.sessionFilePath}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(session), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.renameSync(tempFilePath, this.sessionFilePath);
      fs.chmodSync(this.sessionFilePath, 0o600);
      this.debugMode.debug('[SESSION]', 'Session persisted (with device IDs)');
    } catch (error: any) {
      this.debugMode.debug('[SESSION]', 'Failed to persist session:', error?.message);
    }
  }

  private clearPersistedSession(): void {
    if (!this.sessionFilePath) return;
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        fs.unlinkSync(this.sessionFilePath);
      }
    } catch (error: any) {
      this.debugMode.debug('[SESSION]', 'Failed to clear persisted session:', error?.message);
    }
  }

  private async refreshSessionForExpiredToken(errorCode: unknown, attempt: number) {
    if (!isTokenInvalidCode(errorCode) || attempt > 0) {
      return false;
    }

    this.clearPersistedSession();
    return this.loginInternal();
  }

  private generateDetailBody() {
    return {
      appVersion: this.APP_VERSION,
      phoneBrand: this.PHONE_BRAND,
      traceId: String(Date.now()),
      phoneOS: this.OS
    };
  }

  private generateBody(includeAuth = false) {
    return {
      acceptLanguage: this.LANG,
      timeZone: this.TIMEZONE,
      ...(includeAuth
        ? {
          accountID: this.accountId,
          token: this.token
        }
        : {})
    };
  }

  private generateV2Body(fan: VeSyncGeneric, method: BypassMethod | HumidifierBypassMethod, data = {}) {
    return {
      method: 'bypassV2',
      debugMode: false,
      deviceRegion: fan.region,
      cid: fan.cid,
      configModule: fan.configModule,
      payload: {
        data: {
          ...data
        },
        method,
        source: 'APP'
      }
    };
  }

  public async sendCommand(
    fan: VeSyncGeneric,
    method: BypassMethod | HumidifierBypassMethod,
    body = {}
  ): Promise<boolean> {
    return lock.acquire('api-call', async () => {
      try {
        this.debugMode.debug('[SEND COMMAND]', `${method} to ${fan.name}`);

        for (let attempt = 0; attempt < 2; attempt++) {
          const api = this.requireApiClient();
          const response = await retryWithBackoff(
            () =>
              api.put('cloud/v2/deviceManaged/bypassV2', {
                ...this.generateV2Body(fan, method, body),
                ...this.generateDetailBody(),
                ...this.generateBody(true)
              }),
            3,
            1000
          );

          if (!response?.data) return false;

          if (response?.data?.code === 0) {
            await delay(500);
            return true;
          }

          const errorCode = response?.data?.code;
          if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
            this.debugMode.debug('[SEND COMMAND]', 'Token expired, re-login...');
            continue;
          }

          this.log.error(`Command ${method} failed: ${response?.data?.msg} (${errorCode})`);
          return false;
        }
        return false;
      } catch (error: any) {
        this.log.error(`Command ${method} error:`, error?.message);
        return false;
      }
    });
  }

  public async getDeviceInfo(fan: VeSyncGeneric, humidifier = false): Promise<any> {
    return lock.acquire('api-call', async () => {
      try {
        this.debugMode.debug('[GET DEVICE INFO]', 'Fetching...');

        for (let attempt = 0; attempt < 2; attempt++) {
          const api = this.requireApiClient();
          const response = await retryWithBackoff(
            () =>
              api.post('cloud/v2/deviceManaged/bypassV2', {
                ...this.generateV2Body(
                  fan,
                  humidifier ? HumidifierBypassMethod.STATUS : BypassMethod.STATUS
                ),
                ...this.generateDetailBody(),
                ...this.generateBody(true)
              }),
            3,
            1000
          );

          if (!response?.data) return null;

          if (response.data.code !== 0 && response.data.code !== undefined) {
            const errorCode = response.data.code;
            if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
              continue;
            }
            return null;
          }

          await delay(500);
          this.debugMode.debug('[GET DEVICE INFO]', 'JSON:', JSON.stringify(sanitizeForDebug(response.data)));
          return response.data;
        }
        return null;
      } catch (error: any) {
        this.log.error(`Device info error for ${fan?.name}:`, error?.message);
        return null;
      }
    });
  }

  public async startSession(): Promise<boolean> {
    this.debugMode.debug('[START SESSION]', 'Starting auth session...');

    const persisted = this.loadPersistedSession();
    if (persisted) {
      this.token = persisted.token;
      this.accountId = persisted.accountId;
      this.baseURL = persisted.baseURL;
      this.tokenExpiresAt = persisted.expiresAt;

      this.api = this.createAuthenticatedApiClient();

      this.log.info('Reusing persisted VeSync session (no new login required)');
      this.debugMode.debug('[SESSION]', `Token expires: ${this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : 'unknown'}`);
    } else {
      const loginSuccess = await this.login();
      if (!loginSuccess) return false;
    }
    
    if (this.loginInterval) {
      clearInterval(this.loginInterval);
    }
    
    this.loginInterval = setInterval(async () => {
      this.debugMode.debug('[TOKEN REFRESH]', 'Refreshing token...');
      await this.login();
    }, SESSION_REFRESH_MS);
    
    return true;
  }

  public stopSession(): void {
    if (this.loginInterval) {
      clearInterval(this.loginInterval);
      this.loginInterval = undefined;
      this.debugMode.debug('[STOP SESSION]', 'Session stopped');
    }
  }

  private async login(): Promise<boolean> {
    return lock.acquire('api-call', async () => this.loginInternal());
  }

  private async loginInternal(): Promise<boolean> {
    try {
      if (!this.email || !this.password) {
        throw new Error('Email and password are required');
      }

      this.debugMode.debug('[LOGIN]', 'Starting new auth flow...');

      const pwdHashed = crypto.createHash('md5').update(this.password).digest('hex');
      
      if (!this.appId) {
        this.appId = generateAppId();
        this.debugMode.debug('[LOGIN]', 'Generated new appId');
      }
      if (!this.terminalId) {
        this.terminalId = generateTerminalId();
        this.debugMode.debug('[LOGIN]', 'Generated new terminalId');
      }
      
      const appId = this.appId;
      const terminalId = this.terminalId;

      const authHeaders = {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': this.AGENT,
        'accept-language': this.LANG,
        'appVersion': this.APP_VERSION,
        'clientVersion': this.CLIENT_VERSION
      };

      for (const baseUrl of [this.baseURL, this.getAlternateBaseURL()]) {
        this.debugMode.debug('[LOGIN]', `Trying endpoint: ${baseUrl}`);

        const step1Body = {
          email: this.email,
          method: 'authByPWDOrOTM',
          password: pwdHashed,
          acceptLanguage: this.LANG,
          accountID: '',
          authProtocolType: 'generic',
          clientInfo: this.CLIENT_INFO,
          clientType: 'vesyncApp',
          clientVersion: this.CLIENT_VERSION,
          debugMode: false,
          osInfo: this.OS,
          terminalId: terminalId,
          timeZone: this.TIMEZONE,
          token: '',
          userCountryCode: this.COUNTRY_CODE,
          appID: appId,
          sourceAppID: appId,
          traceId: `APP${appId}${Math.floor(Date.now() / 1000)}`
        };

        try {
          const step1Response = await axios.post(
            `${baseUrl}/globalPlatform/api/accountAuth/v1/authByPWDOrOTM`,
            step1Body,
            { headers: authHeaders, timeout: 15000 }
          );

          if (!step1Response?.data || step1Response.data.code !== 0) {
            const code = step1Response?.data?.code;

            if (CREDENTIAL_ERROR_CODES.includes(code)) {
              this.log.error('Login failed: Invalid email or password');
              return false;
            }

            if (CROSS_REGION_ERROR_CODES.includes(code)) {
              this.debugMode.debug('[LOGIN]', 'Cross-region error, trying alternate...');
              continue;
            }

            return await this.loginLegacy(pwdHashed, baseUrl);
          }

          const { authorizeCode, bizToken } = step1Response.data.result || {};
          if (!authorizeCode) continue;

          this.debugMode.debug('[LOGIN]', 'Step 1 success');

          const step2Body: Record<string, unknown> = {
            method: 'loginByAuthorizeCode4Vesync',
            authorizeCode: authorizeCode,
            acceptLanguage: this.LANG,
            clientInfo: this.CLIENT_INFO,
            clientType: 'vesyncApp',
            clientVersion: this.CLIENT_VERSION,
            debugMode: false,
            emailSubscriptions: false,
            osInfo: this.OS,
            terminalId: terminalId,
            timeZone: this.TIMEZONE,
            userCountryCode: this.COUNTRY_CODE,
            traceId: `APP${appId}${Math.floor(Date.now() / 1000)}`
          };

          if (bizToken) step2Body.bizToken = bizToken;

          const step2Response = await axios.post(
            `${baseUrl}/user/api/accountManage/v1/loginByAuthorizeCode4Vesync`,
            step2Body,
            { headers: authHeaders, timeout: 15000 }
          );

          if (!step2Response?.data || step2Response.data.code !== 0) {
            const code = step2Response?.data?.code;
            if (CROSS_REGION_ERROR_CODES.includes(code)) continue;
            continue;
          }

          const { token, accountID } = step2Response.data.result || {};
          if (!token || !accountID) continue;

          this.debugMode.debug('[LOGIN]', 'Authentication successful!');
          this.baseURL = baseUrl;
          this.token = token;
          this.accountId = accountID;

          this.tokenExpiresAt = Date.now() + SESSION_TTL_MS;

          this.api = this.createAuthenticatedApiClient();

          this.saveSession();

          await delay(500);
          return true;

        } catch (error: any) {
          this.debugMode.debug('[LOGIN]', `Request error: ${error?.message}`);
          continue;
        }
      }

      this.log.error('Login failed: Could not authenticate with any endpoint');
      return false;

    } catch (error: any) {
      this.log.error('Login failed:', error?.message);
      return false;
    }
  }

  private async loginLegacy(pwdHashed: string, baseUrl: string): Promise<boolean> {
    this.debugMode.debug('[LOGIN LEGACY]', 'Trying legacy login...');

    try {
      const response = await axios.post(
        `${baseUrl}/cloud/v1/user/login`,
        {
          email: this.email,
          password: pwdHashed,
          devToken: '',
          userType: 1,
          method: 'login',
          token: '',
          ...this.generateDetailBody(),
          ...this.generateBody()
        },
        {
          headers: {
            'content-type': 'application/json',
            'accept-language': this.LANG,
            'user-agent': this.AGENT,
            appversion: this.APP_VERSION,
            tz: this.TIMEZONE,
          },
          timeout: 15000
        }
      );

      if (!response?.data || (response.data.code !== 0 && response.data.code !== undefined)) {
        return false;
      }

      const { token, accountID } = response.data.result || {};
      if (!token || !accountID) return false;

      this.debugMode.debug('[LOGIN LEGACY]', 'Success!');
      this.baseURL = baseUrl;
      this.token = token;
      this.accountId = accountID;
      this.tokenExpiresAt = Date.now() + SESSION_TTL_MS;

      this.api = this.createAuthenticatedApiClient();

      this.saveSession();

      await delay(500);
      return true;

    } catch (error: any) {
      this.debugMode.debug('[LOGIN LEGACY]', 'Error:', error?.message);
      return false;
    }
  }

  private async requestDeviceList(): Promise<any[] | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const api = this.requireApiClient();
      const response = await retryWithBackoff(
        () =>
          api.post('cloud/v2/deviceManaged/devices', {
            method: 'devices',
            pageNo: 1,
            pageSize: 1000,
            ...this.generateDetailBody(),
            ...this.generateBody(true)
          }),
        3,
        1000
      );

      if (!response?.data) {
        return null;
      }

      if (response.data.code !== 0 && response.data.code !== undefined) {
        const errorCode = response.data.code;
        if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
          continue;
        }
        return null;
      }

      if (!Array.isArray(response.data?.result?.list)) {
        return null;
      }

      return response.data.result.list;
    }

    return null;
  }

  public async getDeviceSnapshot(fan: VeSyncGeneric): Promise<any | null> {
    return lock.acquire('api-call', async () => {
      try {
        const list = await this.requestDeviceList();
        return list?.find(({ cid, uuid, macID }) =>
          cid === fan.cid ||
          uuid === fan.uuid ||
          macID === fan.mac
        ) ?? null;
      } catch (error: any) {
        this.debugMode.debug('[GET DEVICE SNAPSHOT]', `Error for ${fan.name}:`, error?.message);
        return null;
      }
    });
  }

  public async getDevices() {
    return lock.acquire<{
      purifiers: VeSyncFan[];
      humidifiers: VeSyncHumidifier[];
    }>('api-call', async () => {
      try {
        const list = await this.requestDeviceList();
        if (!list) {
          return { purifiers: [], humidifiers: [] };
        }

        this.debugMode.debug('[GET DEVICES]', 'Device List:', JSON.stringify(list.map(({ deviceName, deviceType, type }) => ({
          deviceName,
          deviceType,
          type
        }))));
        this.logUnsupportedDevices(list);

        let purifiers = list
          .filter(
            ({ deviceType, type, extension }) =>
              deviceTypes.some(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              extension?.fanSpeedLevel !== undefined
          )
          .map(VeSyncFan.fromResponse(this));

        purifiers = purifiers.concat(list
          .filter(
            ({ deviceType, type, deviceProp }) =>
              deviceTypes.some(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              Boolean(deviceProp)
          )
          .map((fan: any) => ({
            ...fan,
            extension: {
              ...fan.deviceProp,
              airQualityLevel: fan.deviceProp.AQLevel,
              mode: fan.deviceProp.workMode
            }
          }))
          .map(VeSyncFan.fromResponse(this)));

        const humidifiers = list
          .filter(
            ({ deviceType, type, extension }) =>
              humidifierDeviceTypes.some(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              !extension
          )
          .map(VeSyncHumidifier.fromResponse(this));

        await delay(1500);

        return { purifiers, humidifiers };
      } catch (error: any) {
        this.log.error('Failed to get devices:', error?.message);
        return { purifiers: [], humidifiers: [] };
      }
    });
  }

  private logUnsupportedDevices(devices: any[]) {
    devices
      .filter(({ deviceType, type }) =>
        type === 'wifi-air' &&
        !deviceTypes.some(({ isValid }) => isValid(deviceType)) &&
        !humidifierDeviceTypes.some(({ isValid }) => isValid(deviceType))
      )
      .forEach(({ deviceName, deviceType, uuid }) => {
        const key = `${deviceType ?? 'unknown'}:${uuid ?? deviceName ?? 'unknown'}`;
        if (this.unsupportedDeviceKeys.has(key)) {
          return;
        }

        this.unsupportedDeviceKeys.add(key);
        this.log.warn(
          `Unsupported VeSync air device ignored: ${deviceName ?? 'Unknown'} (${deviceType ?? 'unknown'}, ${uuid ?? 'no uuid'})`
        );
      });
  }
}
