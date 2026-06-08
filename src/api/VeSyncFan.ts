import AsyncLock from 'async-lock';
import deviceTypes, { DeviceType, DeviceCategory } from './deviceTypes';

import VeSync, { BypassMethod } from './VeSync';
import { VeSyncGeneric } from './VeSyncGeneric';

export enum AirQuality {
  VERY_GOOD = 1,
  MODERATE = 3,
  UNKNOWN = 0,
  GOOD = 2,
  POOR = 4
}
export enum Mode {
  Manual = 'manual',
  Sleep = 'sleep',
  Auto = 'auto'
}

const COMMAND_STATE_HOLD_MS = 2 * 60 * 1000;

type PendingStateKey = 'isOn' | 'mode' | 'speed' | 'screenVisible' | 'childLock';
type PendingState = {
  expiresAt: number;
  isOn?: boolean;
  mode?: Mode;
  speed?: number;
  screenVisible?: boolean;
  childLock?: boolean;
};

const parseBooleanState = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'on':
    case 'true':
    case 'enabled':
      return true;
    case '0':
    case 'off':
    case 'false':
    case 'disabled':
      return false;
    default:
      return undefined;
  }
};

const parseNumberState = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const parseFanSpeedState = (value: unknown): number | undefined => {
  const speed = parseNumberState(value);
  return speed === 255 ? undefined : speed;
};

const parseModeState = (value: unknown): Mode | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case Mode.Auto:
      return Mode.Auto;
    case Mode.Manual:
      return Mode.Manual;
    case Mode.Sleep:
      return Mode.Sleep;
    default:
      return undefined;
  }
};

export default class VeSyncFan implements VeSyncGeneric {
  private lock: AsyncLock = new AsyncLock();
  public readonly deviceType: DeviceType;
  public readonly deviceCategory: DeviceCategory;
  private lastCheck = 0;
  private pendingState?: PendingState;

  private _screenVisible = true;
  private _childLock = false;
  private _filterLife = 0;
  private _pm25 = 0;

  public readonly manufacturer = 'Levoit';

  public get airQualityLevel() {
    if (!this.deviceType.hasAirQuality) {
      return AirQuality.UNKNOWN;
    }

    return this._airQualityLevel;
  }

  public get screenVisible() {
    return this._screenVisible;
  }

  public get filterLife() {
    return this._filterLife;
  }

  public get childLock() {
    return this._childLock;
  }

  public get speed() {
    return this._speed;
  }

  public get mode() {
    return this._mode;
  }

  public get isOn() {
    return this._isOn;
  }

  public get pm25() {
    if (!this.deviceType.hasPM25) {
      return 0;
    }

    const value = this._pm25;
    return value < 0 ? 0 : value > 1000 ? 1000 : value;
  }

  constructor(
    private readonly client: VeSync,
    public readonly name: string,
    private _mode: Mode,
    private _speed: number,
    public readonly uuid: string,
    private _isOn: boolean,
    private _airQualityLevel: AirQuality,
    public readonly configModule: string,
    public readonly cid: string,
    public readonly region: string,
    public readonly model: string,
    public readonly mac: string
  ) {
    const deviceType = deviceTypes.find(({ isValid }) => isValid(this.model));
    if (!deviceType) {
      throw new Error(`Unsupported purifier model: ${this.model}`);
    }

    this.deviceType = deviceType;
    this.deviceCategory = this.model.includes('V') ? 'Vital' : 'Core';
  }

  public toJSON() {
    return {
      name: this.name,
      uuid: this.uuid,
      configModule: this.configModule,
      cid: this.cid,
      region: this.region,
      model: this.model,
      mac: this.mac,
      manufacturer: this.manufacturer,
      deviceCategory: this.deviceCategory
    };
  }

  private markPendingState(state: Omit<Partial<PendingState>, 'expiresAt'>) {
    const now = Date.now();
    this.pendingState = {
      ...(this.pendingState && this.pendingState.expiresAt > now
        ? this.pendingState
        : {}),
      ...state,
      expiresAt: now + COMMAND_STATE_HOLD_MS
    };
    this.lastCheck = now;
  }

  private clearPendingStateIfEmpty() {
    if (
      this.pendingState &&
      this.pendingState.isOn === undefined &&
      this.pendingState.mode === undefined &&
      this.pendingState.speed === undefined &&
      this.pendingState.screenVisible === undefined &&
      this.pendingState.childLock === undefined
    ) {
      this.pendingState = undefined;
    }
  }

  private shouldAcceptStateValue<T extends boolean | number | Mode>(
    key: PendingStateKey,
    value: T
  ) {
    if (!this.pendingState) {
      return true;
    }

    const pendingValue = this.pendingState[key];
    if (pendingValue === undefined) {
      return true;
    }

    if (Date.now() >= this.pendingState.expiresAt) {
      delete this.pendingState[key];
      this.clearPendingStateIfEmpty();
      return true;
    }

    if (pendingValue === value) {
      delete this.pendingState[key];
      this.clearPendingStateIfEmpty();
      return true;
    }

    this.client.debugMode.debug(
      '[UPDATE INFO]',
      `${this.name}: keeping pending ${key}=${pendingValue}, ignoring stale ${value}`
    );
    return false;
  }

  public async setChildLock(lock: boolean): Promise<boolean> {
    const data = this.deviceCategory === 'Vital' ? {
      childLockSwitch: lock ? 1 : 0
    } : {
      child_lock: lock,
    };
    const success = await this.client.sendCommand(this, BypassMethod.LOCK, data);

    if (success) {
      this._childLock = lock;
      this.markPendingState({ childLock: lock });
    }

    return success;
  }

  public async setPower(power: boolean): Promise<boolean> {
    const data = this.deviceCategory === 'Vital' ? {
      powerSwitch: power ? 1 : 0,
      switchIdx: 0
    } : {
      enabled: power,
      id: 0
    };
    const success = await this.client.sendCommand(this, BypassMethod.SWITCH, data);

    if (success) {
      this._isOn = power;
      this.markPendingState({ isOn: power });
    }

    return success;
  }

  public async changeMode(mode: Mode): Promise<boolean> {
    if (
      (mode === Mode.Auto || mode === Mode.Manual) &&
      !this.deviceType.hasAutoMode
    ) {
      return false;
    }

    const data = this.deviceCategory === 'Vital' ? {
      workMode: mode.toString()
    } : {
      mode: mode.toString()
    };
    const success = await this.client.sendCommand(this, BypassMethod.MODE, data);

    if (success) {
      this._mode = mode;
      this.markPendingState({ mode });
    }

    return success;
  }

  public async changeSpeed(speed: number): Promise<boolean> {
    if (speed > this.deviceType.speedLevels - 1 || speed <= 0) {
      return false;
    }

    if (this.deviceType.hasAutoMode && this._mode !== Mode.Manual) {
      const modeSuccess = await this.changeMode(Mode.Manual);
      if (!modeSuccess) {
        return false;
      }
    }

    const data = this.deviceCategory === 'Vital' ? {
      manualSpeedLevel: speed,
      switchIdx: 0,
      type: 'wind'
    } : {
      level: speed,
      type: 'wind',
      id: 0
    };

    const success = await this.client.sendCommand(this, BypassMethod.SPEED, data);

    if (success) {
      this._speed = speed;
      this._mode = Mode.Manual;
      this.markPendingState({ mode: Mode.Manual, speed });
    }

    return success;
  }

  public async setDisplay(display: boolean): Promise<boolean> {
    const data = this.deviceCategory === 'Vital' ? {
      screenSwitch: display ? 1 : 0
    } : {
      state: display,
      id: 0
    };

    const success = await this.client.sendCommand(this, BypassMethod.DISPLAY, data);

    if (success) {
      this._screenVisible = display;
      this.markPendingState({ screenVisible: display });
    }

    return success;
  }

  public async updateInfo(force = false): Promise<void> {
    return this.lock.acquire('update-info', async () => {
      try {
        if (!force && Date.now() - this.lastCheck < this.client.deviceUpdateIntervalMs) {
          return;
        }

        const snapshot = await this.client.getDeviceSnapshot(this);
        const data = await this.client.getDeviceInfo(this);
        this.lastCheck = Date.now();

        if (!data?.result?.result && !snapshot) {
          return;
        }

        const result = data?.result?.result ?? {};

        this._pm25 = this.deviceType.hasPM25 ? (result.air_quality_value ?? result.PM25 ?? 0) : 0;
        this._airQualityLevel = this.deviceType.hasAirQuality
          ? (result.air_quality ?? result.AQLevel ?? AirQuality.UNKNOWN)
          : AirQuality.UNKNOWN;
        this._filterLife = result.filter_life ?? result.filterLifePercent ?? 0;
        const screenVisible = parseBooleanState(result.display ?? result.screenSwitch);
        const childLock = parseBooleanState(result.child_lock ?? result.childLockSwitch);
        const snapshotState = snapshot?.extension ?? snapshot?.deviceProp ?? {};
        const snapshotIsOn = parseBooleanState(snapshot?.deviceStatus);
        const snapshotSpeed = parseFanSpeedState(
          snapshotState.fanSpeedLevel ??
          snapshotState.level ??
          snapshotState.manualSpeedLevel
        );
        const snapshotMode = parseModeState(snapshotState.mode ?? snapshotState.workMode);
        const isOn = snapshotIsOn ??
          parseBooleanState(result.enabled ?? result.powerSwitch ?? result.deviceStatus);
        const speed = snapshotSpeed ??
          (snapshotIsOn === false
            ? undefined
            : parseFanSpeedState(result.level ?? result.fanSpeedLevel ?? result.manualSpeedLevel));
        const mode = snapshotMode ?? parseModeState(result.mode ?? result.workMode);

        if (
          screenVisible !== undefined &&
          this.shouldAcceptStateValue('screenVisible', screenVisible)
        ) {
          this._screenVisible = screenVisible;
        }
        if (
          childLock !== undefined &&
          this.shouldAcceptStateValue('childLock', childLock)
        ) {
          this._childLock = childLock;
        }
        if (isOn !== undefined && this.shouldAcceptStateValue('isOn', isOn)) {
          this._isOn = isOn;
        }
        if (speed !== undefined && this.shouldAcceptStateValue('speed', speed)) {
          this._speed = speed;
        }
        if (mode !== undefined && this.shouldAcceptStateValue('mode', mode)) {
          this._mode = mode;
        }

        this.client.debugMode.debug(
          '[UPDATE INFO]',
          `${this.name}: isOn=${this._isOn}, mode=${this._mode}, speed=${this._speed}`
        );
      } catch (err: any) {
        const errorMessage = err?.response?.data 
          ? JSON.stringify(err.response.data)
          : err?.message || 'Unknown error';
        this.client.log.error(
          `Failed to update info for ${this.name}: ${errorMessage}`
        );
        this.client.debugMode.debug('[UPDATE INFO]', `Error for ${this.name}:`, errorMessage);
      }
    });
  }

  public static fromResponse =
    (client: VeSync) =>
      ({
        deviceStatus,
        deviceName,
        extension: { airQualityLevel, fanSpeedLevel, mode },
        uuid,
        configModule,
        cid,
        deviceRegion,
        deviceType,
        macID
      }) =>
        new VeSyncFan(
          client,
          deviceName,
          mode,
          parseInt(fanSpeedLevel ?? '0', 10),
          uuid,
          parseBooleanState(deviceStatus) ?? false,
          airQualityLevel,
          configModule,
          cid,
          deviceRegion,
          deviceType,
          macID
        );
}
