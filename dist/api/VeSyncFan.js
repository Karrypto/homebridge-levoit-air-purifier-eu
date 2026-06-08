"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mode = exports.AirQuality = void 0;
const async_lock_1 = __importDefault(require("async-lock"));
const deviceTypes_1 = __importDefault(require("./deviceTypes"));
const VeSync_1 = require("./VeSync");
var AirQuality;
(function (AirQuality) {
    AirQuality[AirQuality["VERY_GOOD"] = 1] = "VERY_GOOD";
    AirQuality[AirQuality["MODERATE"] = 3] = "MODERATE";
    AirQuality[AirQuality["UNKNOWN"] = 0] = "UNKNOWN";
    AirQuality[AirQuality["GOOD"] = 2] = "GOOD";
    AirQuality[AirQuality["POOR"] = 4] = "POOR";
})(AirQuality || (exports.AirQuality = AirQuality = {}));
var Mode;
(function (Mode) {
    Mode["Manual"] = "manual";
    Mode["Sleep"] = "sleep";
    Mode["Auto"] = "auto";
})(Mode || (exports.Mode = Mode = {}));
const COMMAND_STATE_HOLD_MS = 2 * 60 * 1000;
const parseBooleanState = (value) => {
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
const parseNumberState = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
const parseFanSpeedState = (value) => {
    const speed = parseNumberState(value);
    return speed === 255 ? undefined : speed;
};
const parseModeState = (value) => {
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
class VeSyncFan {
    get airQualityLevel() {
        if (!this.deviceType.hasAirQuality) {
            return AirQuality.UNKNOWN;
        }
        return this._airQualityLevel;
    }
    get screenVisible() {
        return this._screenVisible;
    }
    get filterLife() {
        return this._filterLife;
    }
    get childLock() {
        return this._childLock;
    }
    get speed() {
        return this._speed;
    }
    get mode() {
        return this._mode;
    }
    get isOn() {
        return this._isOn;
    }
    get pm25() {
        if (!this.deviceType.hasPM25) {
            return 0;
        }
        const value = this._pm25;
        return value < 0 ? 0 : value > 1000 ? 1000 : value;
    }
    constructor(client, name, _mode, _speed, uuid, _isOn, _airQualityLevel, configModule, cid, region, model, mac) {
        this.client = client;
        this.name = name;
        this._mode = _mode;
        this._speed = _speed;
        this.uuid = uuid;
        this._isOn = _isOn;
        this._airQualityLevel = _airQualityLevel;
        this.configModule = configModule;
        this.cid = cid;
        this.region = region;
        this.model = model;
        this.mac = mac;
        this.lock = new async_lock_1.default();
        this.lastCheck = 0;
        this._screenVisible = true;
        this._childLock = false;
        this._filterLife = 0;
        this._pm25 = 0;
        this.manufacturer = 'Levoit';
        const deviceType = deviceTypes_1.default.find(({ isValid }) => isValid(this.model));
        if (!deviceType) {
            throw new Error(`Unsupported purifier model: ${this.model}`);
        }
        this.deviceType = deviceType;
        this.deviceCategory = this.model.includes('V') ? 'Vital' : 'Core';
    }
    toJSON() {
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
    markPendingState(state) {
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
    clearPendingStateIfEmpty() {
        if (this.pendingState &&
            this.pendingState.isOn === undefined &&
            this.pendingState.mode === undefined &&
            this.pendingState.speed === undefined &&
            this.pendingState.screenVisible === undefined &&
            this.pendingState.childLock === undefined) {
            this.pendingState = undefined;
        }
    }
    shouldAcceptStateValue(key, value) {
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
        this.client.debugMode.debug('[UPDATE INFO]', `${this.name}: keeping pending ${key}=${pendingValue}, ignoring stale ${value}`);
        return false;
    }
    async setChildLock(lock) {
        const data = this.deviceCategory === 'Vital' ? {
            childLockSwitch: lock ? 1 : 0
        } : {
            child_lock: lock,
        };
        const success = await this.client.sendCommand(this, VeSync_1.BypassMethod.LOCK, data);
        if (success) {
            this._childLock = lock;
            this.markPendingState({ childLock: lock });
        }
        return success;
    }
    async setPower(power) {
        const data = this.deviceCategory === 'Vital' ? {
            powerSwitch: power ? 1 : 0,
            switchIdx: 0
        } : {
            enabled: power,
            id: 0
        };
        const success = await this.client.sendCommand(this, VeSync_1.BypassMethod.SWITCH, data);
        if (success) {
            this._isOn = power;
            this.markPendingState({ isOn: power });
        }
        return success;
    }
    async changeMode(mode) {
        if ((mode === Mode.Auto || mode === Mode.Manual) &&
            !this.deviceType.hasAutoMode) {
            return false;
        }
        const data = this.deviceCategory === 'Vital' ? {
            workMode: mode.toString()
        } : {
            mode: mode.toString()
        };
        const success = await this.client.sendCommand(this, VeSync_1.BypassMethod.MODE, data);
        if (success) {
            this._mode = mode;
            this.markPendingState({ mode });
        }
        return success;
    }
    async changeSpeed(speed) {
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
        const success = await this.client.sendCommand(this, VeSync_1.BypassMethod.SPEED, data);
        if (success) {
            this._speed = speed;
            this._mode = Mode.Manual;
            this.markPendingState({ mode: Mode.Manual, speed });
        }
        return success;
    }
    async setDisplay(display) {
        const data = this.deviceCategory === 'Vital' ? {
            screenSwitch: display ? 1 : 0
        } : {
            state: display,
            id: 0
        };
        const success = await this.client.sendCommand(this, VeSync_1.BypassMethod.DISPLAY, data);
        if (success) {
            this._screenVisible = display;
            this.markPendingState({ screenVisible: display });
        }
        return success;
    }
    async updateInfo(force = false) {
        return this.lock.acquire('update-info', async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            try {
                if (!force && Date.now() - this.lastCheck < this.client.deviceUpdateIntervalMs) {
                    return;
                }
                const snapshot = await this.client.getDeviceSnapshot(this);
                const data = await this.client.getDeviceInfo(this);
                this.lastCheck = Date.now();
                if (!((_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.result) && !snapshot) {
                    return;
                }
                const result = (_c = (_b = data === null || data === void 0 ? void 0 : data.result) === null || _b === void 0 ? void 0 : _b.result) !== null && _c !== void 0 ? _c : {};
                this._pm25 = this.deviceType.hasPM25 ? ((_e = (_d = result.air_quality_value) !== null && _d !== void 0 ? _d : result.PM25) !== null && _e !== void 0 ? _e : 0) : 0;
                this._airQualityLevel = this.deviceType.hasAirQuality
                    ? ((_g = (_f = result.air_quality) !== null && _f !== void 0 ? _f : result.AQLevel) !== null && _g !== void 0 ? _g : AirQuality.UNKNOWN)
                    : AirQuality.UNKNOWN;
                this._filterLife = (_j = (_h = result.filter_life) !== null && _h !== void 0 ? _h : result.filterLifePercent) !== null && _j !== void 0 ? _j : 0;
                const screenVisible = parseBooleanState((_k = result.display) !== null && _k !== void 0 ? _k : result.screenSwitch);
                const childLock = parseBooleanState((_l = result.child_lock) !== null && _l !== void 0 ? _l : result.childLockSwitch);
                const snapshotState = (_o = (_m = snapshot === null || snapshot === void 0 ? void 0 : snapshot.extension) !== null && _m !== void 0 ? _m : snapshot === null || snapshot === void 0 ? void 0 : snapshot.deviceProp) !== null && _o !== void 0 ? _o : {};
                const snapshotIsOn = parseBooleanState(snapshot === null || snapshot === void 0 ? void 0 : snapshot.deviceStatus);
                const snapshotSpeed = parseFanSpeedState((_q = (_p = snapshotState.fanSpeedLevel) !== null && _p !== void 0 ? _p : snapshotState.level) !== null && _q !== void 0 ? _q : snapshotState.manualSpeedLevel);
                const snapshotMode = parseModeState((_r = snapshotState.mode) !== null && _r !== void 0 ? _r : snapshotState.workMode);
                const isOn = snapshotIsOn !== null && snapshotIsOn !== void 0 ? snapshotIsOn : parseBooleanState((_t = (_s = result.enabled) !== null && _s !== void 0 ? _s : result.powerSwitch) !== null && _t !== void 0 ? _t : result.deviceStatus);
                const speed = snapshotSpeed !== null && snapshotSpeed !== void 0 ? snapshotSpeed : (snapshotIsOn === false
                    ? undefined
                    : parseFanSpeedState((_v = (_u = result.level) !== null && _u !== void 0 ? _u : result.fanSpeedLevel) !== null && _v !== void 0 ? _v : result.manualSpeedLevel));
                const mode = snapshotMode !== null && snapshotMode !== void 0 ? snapshotMode : parseModeState((_w = result.mode) !== null && _w !== void 0 ? _w : result.workMode);
                if (screenVisible !== undefined &&
                    this.shouldAcceptStateValue('screenVisible', screenVisible)) {
                    this._screenVisible = screenVisible;
                }
                if (childLock !== undefined &&
                    this.shouldAcceptStateValue('childLock', childLock)) {
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
                this.client.debugMode.debug('[UPDATE INFO]', `${this.name}: isOn=${this._isOn}, mode=${this._mode}, speed=${this._speed}`);
            }
            catch (err) {
                const errorMessage = ((_x = err === null || err === void 0 ? void 0 : err.response) === null || _x === void 0 ? void 0 : _x.data)
                    ? JSON.stringify(err.response.data)
                    : (err === null || err === void 0 ? void 0 : err.message) || 'Unknown error';
                this.client.log.error(`Failed to update info for ${this.name}: ${errorMessage}`);
                this.client.debugMode.debug('[UPDATE INFO]', `Error for ${this.name}:`, errorMessage);
            }
        });
    }
}
VeSyncFan.fromResponse = (client) => ({ deviceStatus, deviceName, extension: { airQualityLevel, fanSpeedLevel, mode }, uuid, configModule, cid, deviceRegion, deviceType, macID }) => {
    var _a;
    return new VeSyncFan(client, deviceName, mode, parseInt(fanSpeedLevel !== null && fanSpeedLevel !== void 0 ? fanSpeedLevel : '0', 10), uuid, (_a = parseBooleanState(deviceStatus)) !== null && _a !== void 0 ? _a : false, airQualityLevel, configModule, cid, deviceRegion, deviceType, macID);
};
exports.default = VeSyncFan;
//# sourceMappingURL=VeSyncFan.js.map