import axios, { AxiosInstance } from 'axios';
import { Logger } from 'homebridge';
import AsyncLock from 'async-lock';
import crypto from 'crypto';

import deviceTypes, { humidifierDeviceTypes } from './deviceTypes';
import VeSyncHumidifier from './VeSyncHumidifier';
import { VeSyncGeneric } from './VeSyncGeneric';
import DebugMode from '../debugMode';
import VeSyncFan from './VeSyncFan';

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default class VeSync {
  private api?: AxiosInstance;
  private accountId?: string;
  private token?: string;
  private loginInterval?: ReturnType<typeof setInterval>;

  private readonly VERSION = '2.0.0';
  private readonly AGENT = `VeSync/VeSync 3.0.51(F5321;HomeBridge-VeSync ${this.VERSION})`;
  private readonly TIMEZONE = 'America/New_York';
  private readonly OS = 'HomeBridge-VeSync';
  private readonly LANG = 'en';

  private readonly AXIOS_OPTIONS = {
    baseURL: 'https://smartapi.vesync.com',
    timeout: 30000
  };

  constructor(
    private readonly email: string,
    private readonly password: string,
    public readonly debugMode: DebugMode,
    public readonly log: Logger
  ) { }

  private generateDetailBody() {
    return {
      appVersion: this.VERSION,
      phoneBrand: this.OS,
      traceId: Date.now(),
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
        if (!this.api) {
          throw new Error('The user is not logged in!');
        }

        this.debugMode.debug(
          '[SEND COMMAND]',
          `Sending command ${method} to ${fan.name}`,
          `with (${JSON.stringify(body)})...`
        );

        const response = await this.api.put('cloud/v2/deviceManaged/bypassV2', {
          ...this.generateV2Body(fan, method, body),
          ...this.generateDetailBody(),
          ...this.generateBody(true)
        });

        if (!response?.data) {
          this.debugMode.debug(
            '[SEND COMMAND]',
            'No response data!! JSON:',
            JSON.stringify(response)
          );
        }

        const isSuccess = response?.data?.code === 0;
        if (!isSuccess) {
          const errorMsg = response?.data?.msg || 'Unknown error';
          const errorCode = response?.data?.code;
          this.debugMode.debug(
            '[SEND COMMAND]',
            `Failed to send command ${method} to ${fan.name}`,
            `with (${JSON.stringify(body)})!`,
            `Response: ${JSON.stringify(response.data)}`
          );
          this.log.error(
            `Failed to send command ${method} to ${fan.name}: ${errorMsg} (Code: ${errorCode})`
          );
          
          // Bei Token-Fehlern versuche erneut nach Login
          if (errorCode === -11012001 || errorCode === -11012002) {
            this.debugMode.debug('[SEND COMMAND]', 'Token expired, attempting re-login...');
            const loginSuccess = await this.login();
            if (loginSuccess) {
              // Versuche den Befehl erneut
              return await this.sendCommand(fan, method, body);
            }
          }
        }

        await delay(500);

        return isSuccess;
      } catch (error: any) {
        const errorMessage = error?.response?.data 
          ? JSON.stringify(error.response.data)
          : error?.message || 'Unknown error';
        this.log.error(
          `Failed to send command ${method} to ${fan?.name}`,
          `Error: ${errorMessage}`
        );
        this.debugMode.debug('[SEND COMMAND]', 'Error details:', errorMessage);
        return false;
      }
    });
  }

  public async getDeviceInfo(fan: VeSyncGeneric, humidifier = false): Promise<any> {
    return lock.acquire('api-call', async () => {
      try {
        if (!this.api) {
          throw new Error('The user is not logged in!');
        }

        this.debugMode.debug('[GET DEVICE INFO]', 'Getting device info...');

        const response = await this.api.post(
          'cloud/v2/deviceManaged/bypassV2',
          {
            ...this.generateV2Body(fan, humidifier ? HumidifierBypassMethod.STATUS : BypassMethod.STATUS),
            ...this.generateDetailBody(),
            ...this.generateBody(true)
          }
        );

        if (!response?.data) {
          this.debugMode.debug(
            '[GET DEVICE INFO]',
            'No response data!! JSON:',
            JSON.stringify(response)
          );
          return null;
        }

        // Prüfe auf API-Fehler
        if (response.data.code !== 0 && response.data.code !== undefined) {
          const errorMsg = response.data.msg || 'Unknown error';
          const errorCode = response.data.code;
          this.debugMode.debug(
            '[GET DEVICE INFO]',
            `API error: ${errorMsg} (Code: ${errorCode})`,
            JSON.stringify(response.data)
          );
          
          // Bei Token-Fehlern versuche erneut nach Login
          if (errorCode === -11012001 || errorCode === -11012002) {
            this.debugMode.debug('[GET DEVICE INFO]', 'Token expired, attempting re-login...');
            const loginSuccess = await this.login();
            if (loginSuccess) {
              // Versuche erneut
              return await this.getDeviceInfo(fan, humidifier);
            }
          }
          
          return null;
        }

        await delay(500);

        this.debugMode.debug(
          '[GET DEVICE INFO]',
          'JSON:',
          JSON.stringify(response.data)
        );

        return response.data;
      } catch (error: any) {
        const errorMessage = error?.response?.data 
          ? JSON.stringify(error.response.data)
          : error?.message || 'Unknown error';
        this.log.error(
          `Failed to get device info for ${fan?.name}`,
          `Error: ${errorMessage}`
        );
        this.debugMode.debug('[GET DEVICE INFO]', 'Error details:', errorMessage);

        return null;
      }
    });
  }

  public async startSession(): Promise<boolean> {
    this.debugMode.debug('[START SESSION]', 'Starting auth session...');
    const firstLoginSuccess = await this.login();
    
    // Stoppe vorhandenes Interval, falls vorhanden
    if (this.loginInterval) {
      clearInterval(this.loginInterval);
    }
    
    // Token alle 55 Minuten erneuern (Token ist 60 Minuten gültig)
    this.loginInterval = setInterval(async () => {
      this.debugMode.debug('[TOKEN REFRESH]', 'Refreshing token...');
      await this.login();
    }, 1000 * 60 * 55);
    
    return firstLoginSuccess;
  }

  public stopSession(): void {
    if (this.loginInterval) {
      clearInterval(this.loginInterval);
      this.loginInterval = undefined;
      this.debugMode.debug('[STOP SESSION]', 'Session stopped');
    }
  }

  private async login(): Promise<boolean> {
    return lock.acquire('api-call', async () => {
      try {
        if (!this.email || !this.password) {
          throw new Error('Email and password are required');
        }

        this.debugMode.debug('[LOGIN]', 'Logging in...');

        const pwdHashed = crypto
          .createHash('md5')
          .update(this.password)
          .digest('hex');

        const response = await axios.post(
          'cloud/v1/user/login',
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
            ...this.AXIOS_OPTIONS
          }
        );

        if (!response?.data) {
          this.debugMode.debug(
            '[LOGIN]',
            'No response data!! JSON:',
            JSON.stringify(response)
          );
          return false;
        }

        // Prüfe auf API-Fehler
        if (response.data.code !== 0 && response.data.code !== undefined) {
          this.debugMode.debug(
            '[LOGIN]',
            'The authentication failed!! JSON:',
            JSON.stringify(response.data)
          );
          this.log.error(
            `Login failed: ${response.data.msg || 'Unknown error'} (Code: ${response.data.code})`
          );
          return false;
        }

        const { result } = response.data;
        const { token, accountID } = result ?? {};

        if (!token || !accountID) {
          this.debugMode.debug(
            '[LOGIN]',
            'The authentication failed!! JSON:',
            JSON.stringify(response.data)
          );
          this.log.error('Login failed: Missing token or accountID');
          return false;
        }

        this.debugMode.debug('[LOGIN]', 'The authentication success');

        this.accountId = accountID;
        this.token = token;

        this.api = axios.create({
          ...this.AXIOS_OPTIONS,
          headers: {
            'content-type': 'application/json',
            'accept-language': this.LANG,
            accountid: this.accountId!,
            'user-agent': this.AGENT,
            appversion: this.VERSION,
            tz: this.TIMEZONE,
            tk: this.token!
          }
        });

        await delay(500);
        return true;
      } catch (error: any) {
        const errorMessage = error?.response?.data 
          ? JSON.stringify(error.response.data)
          : error?.message || 'Unknown error';
        this.log.error('Failed to login', `Error: ${errorMessage}`);
        this.debugMode.debug('[LOGIN]', 'Login error details:', errorMessage);
        return false;
      }
    });
  }

  public async getDevices() {
    return lock.acquire<{
      purifiers: VeSyncFan[];
      humidifiers: VeSyncHumidifier[];
    }>('api-call', async () => {
      try {
        if (!this.api) {
          throw new Error('The user is not logged in!');
        }

        const response = await this.api.post('cloud/v2/deviceManaged/devices', {
          method: 'devices',
          pageNo: 1,
          pageSize: 1000,
          ...this.generateDetailBody(),
          ...this.generateBody(true)
        });

        if (!response?.data) {
          this.debugMode.debug(
            '[GET DEVICES]',
            'No response data!! JSON:',
            JSON.stringify(response)
          );

          return {
            purifiers: [],
            humidifiers: []
          };
        }

        // Prüfe auf API-Fehler
        if (response.data.code !== 0 && response.data.code !== undefined) {
          const errorMsg = response.data.msg || 'Unknown error';
          const errorCode = response.data.code;
          this.debugMode.debug(
            '[GET DEVICES]',
            `API error: ${errorMsg} (Code: ${errorCode})`,
            JSON.stringify(response.data)
          );
          
          // Bei Token-Fehlern versuche erneut nach Login
          if (errorCode === -11012001 || errorCode === -11012002) {
            this.debugMode.debug('[GET DEVICES]', 'Token expired, attempting re-login...');
            const loginSuccess = await this.login();
            if (loginSuccess) {
              // Versuche erneut
              return await this.getDevices();
            }
          }
          
          return {
            purifiers: [],
            humidifiers: []
          };
        }

        if (!Array.isArray(response.data?.result?.list)) {
          this.debugMode.debug(
            '[GET DEVICES]',
            'No list found!! JSON:',
            JSON.stringify(response.data)
          );

          return {
            purifiers: [],
            humidifiers: []
          };
        }

        const { list } = response.data.result ?? { list: [] };

        this.debugMode.debug(
          '[GET DEVICES]',
          'Device List -> JSON:',
          JSON.stringify(list)
        );


        let purifiers = list
          .filter(
            ({ deviceType, type, extension }) =>
              !!deviceTypes.find(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              !!extension?.fanSpeedLevel
          )
          .map(VeSyncFan.fromResponse(this));

          // Newer Vital purifiers
          purifiers = purifiers.concat(list
          .filter(
            ({ deviceType, type, deviceProp }) =>
              !!deviceTypes.find(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              !!deviceProp
          )
          .map((fan: any) => ({ ...fan, extension: { ...fan.deviceProp, airQualityLevel: fan.deviceProp.AQLevel, mode: fan.deviceProp.workMode } }))
          .map(VeSyncFan.fromResponse(this)));

        const humidifiers = list
          .filter(
            ({ deviceType, type, extension }) =>
              !!humidifierDeviceTypes.find(({ isValid }) => isValid(deviceType)) &&
              type === 'wifi-air' &&
              !extension
          )
          .map(VeSyncHumidifier.fromResponse(this));

        await delay(1500);

        return {
          purifiers,
          humidifiers
        };
      } catch (error: any) {
        const errorMessage = error?.response?.data 
          ? JSON.stringify(error.response.data)
          : error?.message || 'Unknown error';
        this.log.error('Failed to get devices', `Error: ${errorMessage}`);
        this.debugMode.debug('[GET DEVICES]', 'Error details:', errorMessage);
        return {
          purifiers: [],
          humidifiers: []
        };
      }
    });
  }
}
