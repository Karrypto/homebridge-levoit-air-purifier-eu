import {
  DynamicPlatformPlugin,
  PlatformAccessory,
  PlatformConfig,
  Characteristic,
  Service,
  Logger,
  API
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import VeSyncPurAccessory from './VeSyncPurAccessory';
import VeSyncHumAccessory from './VeSyncHumAccessory';
import VeSyncHumidifier from './api/VeSyncHumidifier';
import { ExperimentalFeatures } from './types';
import VeSyncFan from './api/VeSyncFan';
import DebugMode from './debugMode';
import VeSync from './api/VeSync';
import { clamp } from './util';

export interface VeSyncContext {
  name: string;
  device: VeSyncFan | VeSyncHumidifier;
}

export enum VeSyncAdditionalType {
  Sensor,
  Light
}

export interface VeSyncAdditionalContext {
  name: string;
  parent: string;
  type: VeSyncAdditionalType;
}

export type VeSyncPlatformAccessory = PlatformAccessory<
  VeSyncContext | VeSyncAdditionalContext
>;
export type AdditionalAccessories = Partial<Record<
  VeSyncAdditionalType,
  VeSyncPlatformAccessory
>>;

const MIN_REDISCOVERY_INTERVAL_MS = 5 * 60 * 1000;
const MAX_REDISCOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MISSED_DISCOVERIES_BEFORE_REMOVAL = 3;

const normalizeDeviceFilter = (devices?: string[]) =>
  new Set(
    (devices ?? [])
      .map((device) => device.trim().toLowerCase())
      .filter((device) => device.length > 0)
  );

const normalizeRediscoveryIntervalMs = (minutes?: number) => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }

  return clamp(
    Math.round(minutes) * 60 * 1000,
    MIN_REDISCOVERY_INTERVAL_MS,
    MAX_REDISCOVERY_INTERVAL_MS
  );
};

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
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly registeredDevices: (VeSyncPurAccessory | VeSyncHumAccessory)[] = [];
  public readonly cachedAccessories: VeSyncPlatformAccessory[] = [];
  public readonly cachedAdditional: VeSyncPlatformAccessory[] = [];

  public readonly debugger: DebugMode;
  private readonly client?: VeSync;
  private readonly excludeDevices: Set<string>;
  private readonly includeDevices: Set<string>;
  private readonly rediscoveryIntervalMs: number;
  private discoveryInProgress = false;
  private rediscoveryTimer?: ReturnType<typeof setInterval>;
  private statusRefreshInProgress = false;
  private statusRefreshTimer?: ReturnType<typeof setInterval>;
  private readonly missingCachedAccessoryCounts = new Map<string, number>();

  constructor(
    public readonly log: Logger,
    public readonly config: Config,
    public readonly api: API
  ) {
    const {
      email,
      password,
      enableDebugMode,
      countryCode,
      excludeDevices,
      includeDevices,
      rediscoveryInterval,
      refreshInterval
    } = this.config ?? {};
    this.debugger = new DebugMode(Boolean(enableDebugMode), this.log);
    this.excludeDevices = normalizeDeviceFilter(excludeDevices);
    this.includeDevices = normalizeDeviceFilter(includeDevices);
    this.rediscoveryIntervalMs = normalizeRediscoveryIntervalMs(rediscoveryInterval);

    try {
      if (!email || !password) {
        this.log.info('Set up the configuration first.');
        this.cleanAccessories();
        return;
      }

      this.debugger.debug('[PLATFORM]', 'Debug mode enabled');

      this.client = new VeSync(email, password, this.debugger, log, {
        countryCode,
        refreshInterval,
        storagePath: this.api.user.storagePath(),
      });

      this.api.on('didFinishLaunching', async () => {
        await this.discoverDevices();
        this.startRediscovery();
        this.startStatusRefresh();
      });

      this.api.on('shutdown', () => {
        this.debugger.debug('[PLATFORM]', 'Shutdown received - stopping VeSync session...');
        this.stopRediscovery();
        this.stopStatusRefresh();
        this.client?.stopSession();
      });
    } catch (error: any) {
      this.log.error(`Error: ${error?.message}`);
    }
  }

  configureAccessory(accessory: VeSyncPlatformAccessory) {
    const additional = (accessory.context as VeSyncAdditionalContext);
    if (additional.parent) {
      this.cachedAdditional.push(accessory);
      return;
    }

    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  private cleanAccessories() {
    try {
      if (this.cachedAccessories.length > 0 || this.cachedAdditional.length > 0) {
        this.debugger.debug(
          '[PLATFORM]',
          'Removing cached accessories because the email and password are not set (Count:',
          `${this.cachedAccessories.length})`
        );

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          ...this.cachedAccessories,
          ...this.cachedAdditional
        ]);
      }
    } catch (error: any) {
      this.log.error(`Error for cached accessories: ${error?.message}`);
    }
  }

  private async discoverDevices() {
    if (this.discoveryInProgress) {
      this.debugger.debug('[PLATFORM]', 'Device discovery already running');
      return;
    }

    this.discoveryInProgress = true;

    try {
      if (!this.client) {
        return;
      }

      this.log.info('Connecting to the servers...');
      const successLogin = await this.client.startSession();
      if (!successLogin) {
        return;
      }

      this.log.info('Discovering devices...');

      const { purifiers, humidifiers } = await this.client.getDevices();

      const experimentalFeatures = this.config?.experimentalFeatures || [];
      const filteredPurifiers = purifiers.filter(this.shouldLoadDevice.bind(this));
      const filteredHumidifiers = humidifiers.filter(this.shouldLoadDevice.bind(this));

      this.registeredDevices.length = 0;

      await Promise.all(filteredPurifiers.map(this.loadDevice.bind(this)));

      if (experimentalFeatures.includes(ExperimentalFeatures.Humidifiers)) {
        await Promise.all(filteredHumidifiers.map(this.loadDevice.bind(this)));
      }

      this.checkOldDevices();
    } catch (error: any) {
      this.log.error(`Error: ${error?.message}`);
    } finally {
      this.discoveryInProgress = false;
    }
  }

  private startRediscovery() {
    if (this.rediscoveryIntervalMs === 0 || this.rediscoveryTimer) {
      return;
    }

    this.rediscoveryTimer = setInterval(() => {
      this.discoverDevices();
    }, this.rediscoveryIntervalMs);
  }

  private stopRediscovery() {
    if (!this.rediscoveryTimer) {
      return;
    }

    clearInterval(this.rediscoveryTimer);
    this.rediscoveryTimer = undefined;
  }

  private startStatusRefresh() {
    if (!this.client || this.statusRefreshTimer) {
      return;
    }

    this.statusRefreshTimer = setInterval(() => {
      this.refreshDeviceStates();
    }, this.client.deviceUpdateIntervalMs);
  }

  private stopStatusRefresh() {
    if (!this.statusRefreshTimer) {
      return;
    }

    clearInterval(this.statusRefreshTimer);
    this.statusRefreshTimer = undefined;
  }

  private async refreshDeviceStates() {
    if (this.statusRefreshInProgress) {
      return;
    }

    this.statusRefreshInProgress = true;

    try {
      await Promise.all(
        this.registeredDevices.map((device) => device.refreshState())
      );
    } catch (error: any) {
      this.log.error(`Failed to refresh device states: ${error?.message}`);
    } finally {
      this.statusRefreshInProgress = false;
    }
  }

  private shouldLoadDevice(device: VeSyncFan | VeSyncHumidifier) {
    const id = device.uuid.toLowerCase();
    const name = device.name.toLowerCase();

    if (this.excludeDevices.has(id) || this.excludeDevices.has(name)) {
      this.log.info('Skipping excluded device:', device.name);
      return false;
    }

    if (
      this.includeDevices.size > 0 &&
      !this.includeDevices.has(id) &&
      !this.includeDevices.has(name)
    ) {
      this.debugger.debug('[PLATFORM]', 'Skipping device not listed in includeDevices:', device.name);
      return false;
    }

    return true;
  }

  private async loadDevice(device: VeSyncFan | VeSyncHumidifier) {
    try {
      await device.updateInfo();
      const { uuid, name } = device;

      const existingAccessory = this.cachedAccessories.find(
        (accessory) => accessory.UUID === uuid
      );

      const additional: AdditionalAccessories = device instanceof VeSyncFan
        ? this.loadAdditional(device)
        : {};

      if (existingAccessory) {
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.displayName
        );

        existingAccessory.context = {
          name,
          device
        };

        this.registeredDevices.push(
          this.createDeviceAccessory(device, existingAccessory, additional)
        );
        return;
      }

      this.log.info('Adding new accessory:', name);
      const accessory = new this.api.platformAccessory<VeSyncContext>(
        name,
        uuid
      );
      accessory.context = {
        name,
        device
      };

      this.registeredDevices.push(
        this.createDeviceAccessory(device, accessory, additional)
      );

      return this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory
      ]);
    } catch (error: any) {
      this.log.error(
        `Error for device: ${device.name}:${device.uuid} | ${error?.message}`
      );
      return null;
    }
  }

  private createDeviceAccessory(
    device: VeSyncFan | VeSyncHumidifier,
    accessory: VeSyncPlatformAccessory,
    additional: AdditionalAccessories
  ) {
    if (device instanceof VeSyncFan) {
      return new VeSyncPurAccessory(this, accessory, additional);
    }

    return new VeSyncHumAccessory(this, accessory);
  }

  private checkOldDevices() {
    const registeredDeviceIds = new Set(
      this.registeredDevices.map((device) => device.UUID)
    );
    const additionalAccessories = new Map<string, VeSyncPlatformAccessory[]>();

    if (registeredDeviceIds.size === 0 && this.cachedAccessories.length > 0) {
      this.log.warn(
        'VeSync discovery returned no registered devices; keeping cached accessories to avoid removing HomeKit devices after a temporary API issue.'
      );
      return;
    }

    this.cachedAdditional.forEach((accessory) => {
      const { parent } = accessory.context as VeSyncAdditionalContext;
      additionalAccessories.set(parent, [
        ...(additionalAccessories.get(parent) ?? []),
        accessory
      ]);
    });

    this.cachedAccessories.forEach((accessory) => {
      try {
        const exists = registeredDeviceIds.has(accessory.UUID);
        const additional = additionalAccessories.get(accessory.UUID) ?? [];

        if (exists) {
          this.missingCachedAccessoryCounts.delete(accessory.UUID);
          return;
        }

        const missedDiscoveries =
          (this.missingCachedAccessoryCounts.get(accessory.UUID) ?? 0) + 1;
        this.missingCachedAccessoryCounts.set(accessory.UUID, missedDiscoveries);

        if (missedDiscoveries < MISSED_DISCOVERIES_BEFORE_REMOVAL) {
          this.log.warn(
            `Cached accessory not found in VeSync discovery (${missedDiscoveries}/${MISSED_DISCOVERIES_BEFORE_REMOVAL}): ${accessory.displayName}`
          );
          return;
        }

        if (!exists) {
          this.log.info('Remove cached accessory:', accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
            ...additional
          ]);
        }
      } catch (error: any) {
        this.log.error(
          `Error for device: ${accessory.displayName} | ${error?.message}`
        );
      }
    });
  }

  private loadAdditional(device: VeSyncFan) {
    const { uuid, name } = device;

    const features = new Set(this.config.experimentalFeatures ?? []);

    const additionalAccessories: AdditionalAccessories = {};
    this.cachedAdditional.forEach((additional) => {
      const context = additional.context as VeSyncAdditionalContext;
      if (context.parent === uuid) {
        additionalAccessories[context.type] = additional;
      }
    });

    this.syncAdditionalAccessory(
      additionalAccessories,
      VeSyncAdditionalType.Sensor,
      device.deviceType.hasAirQuality,
      `${name} Sensor`,
      uuid,
      'sensor'
    );

    this.syncAdditionalAccessory(
      additionalAccessories,
      VeSyncAdditionalType.Light,
      features.has(ExperimentalFeatures.DeviceDisplay),
      `${name} Display`,
      uuid,
      'light'
    );

    return additionalAccessories;
  }

  private syncAdditionalAccessory(
    accessories: AdditionalAccessories,
    type: VeSyncAdditionalType,
    enabled: boolean,
    name: string,
    parentUuid: string,
    uuidSuffix: string
  ) {
    const accessory = accessories[type];

    if (enabled && !accessory) {
      const nextAccessory = new this.api.platformAccessory<VeSyncAdditionalContext>(
        name,
        this.api.hap.uuid.generate(`${parentUuid}-${uuidSuffix}`)
      );

      nextAccessory.context = {
        name,
        parent: parentUuid,
        type
      };

      accessories[type] = nextAccessory;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        nextAccessory
      ]);
      return;
    }

    if (!enabled && accessory) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory
      ]);
      delete accessories[type];
    }
  }
}
