"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VeSyncAdditionalType = void 0;
const settings_1 = require("./settings");
const VeSyncPurAccessory_1 = __importDefault(require("./VeSyncPurAccessory"));
const VeSyncHumAccessory_1 = __importDefault(require("./VeSyncHumAccessory"));
const types_1 = require("./types");
const VeSyncFan_1 = __importDefault(require("./api/VeSyncFan"));
const debugMode_1 = __importDefault(require("./debugMode"));
const VeSync_1 = __importDefault(require("./api/VeSync"));
const util_1 = require("./util");
var VeSyncAdditionalType;
(function (VeSyncAdditionalType) {
    VeSyncAdditionalType[VeSyncAdditionalType["Sensor"] = 0] = "Sensor";
    VeSyncAdditionalType[VeSyncAdditionalType["Light"] = 1] = "Light";
})(VeSyncAdditionalType || (exports.VeSyncAdditionalType = VeSyncAdditionalType = {}));
const MIN_REDISCOVERY_INTERVAL_MS = 5 * 60 * 1000;
const MAX_REDISCOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MISSED_DISCOVERIES_BEFORE_REMOVAL = 3;
const normalizeDeviceFilter = (devices) => new Set((devices !== null && devices !== void 0 ? devices : [])
    .map((device) => device.trim().toLowerCase())
    .filter((device) => device.length > 0));
const normalizeRediscoveryIntervalMs = (minutes) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
        return 0;
    }
    return (0, util_1.clamp)(Math.round(minutes) * 60 * 1000, MIN_REDISCOVERY_INTERVAL_MS, MAX_REDISCOVERY_INTERVAL_MS);
};
class Platform {
    constructor(log, config, api) {
        var _a;
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.registeredDevices = [];
        this.cachedAccessories = [];
        this.cachedAdditional = [];
        this.discoveryInProgress = false;
        this.statusRefreshInProgress = false;
        this.missingCachedAccessoryCounts = new Map();
        const { email, password, enableDebugMode, countryCode, excludeDevices, includeDevices, rediscoveryInterval, refreshInterval } = (_a = this.config) !== null && _a !== void 0 ? _a : {};
        this.debugger = new debugMode_1.default(Boolean(enableDebugMode), this.log);
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
            this.client = new VeSync_1.default(email, password, this.debugger, log, {
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
                var _a;
                this.debugger.debug('[PLATFORM]', 'Shutdown received - stopping VeSync session...');
                this.stopRediscovery();
                this.stopStatusRefresh();
                (_a = this.client) === null || _a === void 0 ? void 0 : _a.stopSession();
            });
        }
        catch (error) {
            this.log.error(`Error: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
    }
    configureAccessory(accessory) {
        const additional = accessory.context;
        if (additional.parent) {
            this.cachedAdditional.push(accessory);
            return;
        }
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.cachedAccessories.push(accessory);
    }
    cleanAccessories() {
        try {
            if (this.cachedAccessories.length > 0 || this.cachedAdditional.length > 0) {
                this.debugger.debug('[PLATFORM]', 'Removing cached accessories because the email and password are not set (Count:', `${this.cachedAccessories.length})`);
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                    ...this.cachedAccessories,
                    ...this.cachedAdditional
                ]);
            }
        }
        catch (error) {
            this.log.error(`Error for cached accessories: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
    }
    async discoverDevices() {
        var _a;
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
            const experimentalFeatures = ((_a = this.config) === null || _a === void 0 ? void 0 : _a.experimentalFeatures) || [];
            const filteredPurifiers = purifiers.filter(this.shouldLoadDevice.bind(this));
            const filteredHumidifiers = humidifiers.filter(this.shouldLoadDevice.bind(this));
            this.registeredDevices.length = 0;
            await Promise.all(filteredPurifiers.map(this.loadDevice.bind(this)));
            if (experimentalFeatures.includes(types_1.ExperimentalFeatures.Humidifiers)) {
                await Promise.all(filteredHumidifiers.map(this.loadDevice.bind(this)));
            }
            this.checkOldDevices();
        }
        catch (error) {
            this.log.error(`Error: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
        finally {
            this.discoveryInProgress = false;
        }
    }
    startRediscovery() {
        if (this.rediscoveryIntervalMs === 0 || this.rediscoveryTimer) {
            return;
        }
        this.rediscoveryTimer = setInterval(() => {
            this.discoverDevices();
        }, this.rediscoveryIntervalMs);
    }
    stopRediscovery() {
        if (!this.rediscoveryTimer) {
            return;
        }
        clearInterval(this.rediscoveryTimer);
        this.rediscoveryTimer = undefined;
    }
    startStatusRefresh() {
        if (!this.client || this.statusRefreshTimer) {
            return;
        }
        this.statusRefreshTimer = setInterval(() => {
            this.refreshDeviceStates();
        }, this.client.deviceUpdateIntervalMs);
    }
    stopStatusRefresh() {
        if (!this.statusRefreshTimer) {
            return;
        }
        clearInterval(this.statusRefreshTimer);
        this.statusRefreshTimer = undefined;
    }
    async refreshDeviceStates() {
        if (this.statusRefreshInProgress) {
            return;
        }
        this.statusRefreshInProgress = true;
        try {
            await Promise.all(this.registeredDevices.map((device) => device.refreshState()));
        }
        catch (error) {
            this.log.error(`Failed to refresh device states: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
        finally {
            this.statusRefreshInProgress = false;
        }
    }
    shouldLoadDevice(device) {
        const id = device.uuid.toLowerCase();
        const name = device.name.toLowerCase();
        if (this.excludeDevices.has(id) || this.excludeDevices.has(name)) {
            this.log.info('Skipping excluded device:', device.name);
            return false;
        }
        if (this.includeDevices.size > 0 &&
            !this.includeDevices.has(id) &&
            !this.includeDevices.has(name)) {
            this.debugger.debug('[PLATFORM]', 'Skipping device not listed in includeDevices:', device.name);
            return false;
        }
        return true;
    }
    async loadDevice(device) {
        try {
            await device.updateInfo();
            const { uuid, name } = device;
            const existingAccessory = this.cachedAccessories.find((accessory) => accessory.UUID === uuid);
            const additional = device instanceof VeSyncFan_1.default
                ? this.loadAdditional(device)
                : {};
            if (existingAccessory) {
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                existingAccessory.context = {
                    name,
                    device
                };
                this.registeredDevices.push(this.createDeviceAccessory(device, existingAccessory, additional));
                return;
            }
            this.log.info('Adding new accessory:', name);
            const accessory = new this.api.platformAccessory(name, uuid);
            accessory.context = {
                name,
                device
            };
            this.registeredDevices.push(this.createDeviceAccessory(device, accessory, additional));
            return this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                accessory
            ]);
        }
        catch (error) {
            this.log.error(`Error for device: ${device.name}:${device.uuid} | ${error === null || error === void 0 ? void 0 : error.message}`);
            return null;
        }
    }
    createDeviceAccessory(device, accessory, additional) {
        if (device instanceof VeSyncFan_1.default) {
            return new VeSyncPurAccessory_1.default(this, accessory, additional);
        }
        return new VeSyncHumAccessory_1.default(this, accessory);
    }
    checkOldDevices() {
        const registeredDeviceIds = new Set(this.registeredDevices.map((device) => device.UUID));
        const additionalAccessories = new Map();
        if (registeredDeviceIds.size === 0 && this.cachedAccessories.length > 0) {
            this.log.warn('VeSync discovery returned no registered devices; keeping cached accessories to avoid removing HomeKit devices after a temporary API issue.');
            return;
        }
        this.cachedAdditional.forEach((accessory) => {
            var _a;
            const { parent } = accessory.context;
            additionalAccessories.set(parent, [
                ...((_a = additionalAccessories.get(parent)) !== null && _a !== void 0 ? _a : []),
                accessory
            ]);
        });
        this.cachedAccessories.forEach((accessory) => {
            var _a, _b;
            try {
                const exists = registeredDeviceIds.has(accessory.UUID);
                const additional = (_a = additionalAccessories.get(accessory.UUID)) !== null && _a !== void 0 ? _a : [];
                if (exists) {
                    this.missingCachedAccessoryCounts.delete(accessory.UUID);
                    return;
                }
                const missedDiscoveries = ((_b = this.missingCachedAccessoryCounts.get(accessory.UUID)) !== null && _b !== void 0 ? _b : 0) + 1;
                this.missingCachedAccessoryCounts.set(accessory.UUID, missedDiscoveries);
                if (missedDiscoveries < MISSED_DISCOVERIES_BEFORE_REMOVAL) {
                    this.log.warn(`Cached accessory not found in VeSync discovery (${missedDiscoveries}/${MISSED_DISCOVERIES_BEFORE_REMOVAL}): ${accessory.displayName}`);
                    return;
                }
                if (!exists) {
                    this.log.info('Remove cached accessory:', accessory.displayName);
                    this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                        accessory,
                        ...additional
                    ]);
                }
            }
            catch (error) {
                this.log.error(`Error for device: ${accessory.displayName} | ${error === null || error === void 0 ? void 0 : error.message}`);
            }
        });
    }
    loadAdditional(device) {
        var _a;
        const { uuid, name } = device;
        const features = new Set((_a = this.config.experimentalFeatures) !== null && _a !== void 0 ? _a : []);
        const additionalAccessories = {};
        this.cachedAdditional.forEach((additional) => {
            const context = additional.context;
            if (context.parent === uuid) {
                additionalAccessories[context.type] = additional;
            }
        });
        this.syncAdditionalAccessory(additionalAccessories, VeSyncAdditionalType.Sensor, device.deviceType.hasAirQuality, `${name} Sensor`, uuid, 'sensor');
        this.syncAdditionalAccessory(additionalAccessories, VeSyncAdditionalType.Light, features.has(types_1.ExperimentalFeatures.DeviceDisplay), `${name} Display`, uuid, 'light');
        return additionalAccessories;
    }
    syncAdditionalAccessory(accessories, type, enabled, name, parentUuid, uuidSuffix) {
        const accessory = accessories[type];
        if (enabled && !accessory) {
            const nextAccessory = new this.api.platformAccessory(name, this.api.hap.uuid.generate(`${parentUuid}-${uuidSuffix}`));
            nextAccessory.context = {
                name,
                parent: parentUuid,
                type
            };
            accessories[type] = nextAccessory;
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                nextAccessory
            ]);
            return;
        }
        if (!enabled && accessory) {
            this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                accessory
            ]);
            delete accessories[type];
        }
    }
}
exports.default = Platform;
//# sourceMappingURL=platform.js.map