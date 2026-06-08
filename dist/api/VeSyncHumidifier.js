"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mode = void 0;
const async_lock_1 = __importDefault(require("async-lock"));
const deviceTypes_1 = require("./deviceTypes");
const VeSync_1 = require("./VeSync");
var Mode;
(function (Mode) {
    Mode["Manual"] = "manual";
    Mode["Auto"] = "auto";
})(Mode || (exports.Mode = Mode = {}));
class VeSyncHumidifier {
    get isOn() {
        return this._isOn;
    }
    get speed() {
        return this._speed;
    }
    get humidity() {
        return this._humidity;
    }
    get targetHumidity() {
        return this._autoTargetHumidity;
    }
    get mode() {
        return this._mode;
    }
    get currentState() {
        if (!this._isOn) {
            return 0;
        }
        if (this._idle) {
            return 1;
        }
        return 2;
    }
    constructor(client, name, uuid, _isOn, cid, region, model, mac, configModule) {
        this.client = client;
        this.name = name;
        this.uuid = uuid;
        this._isOn = _isOn;
        this.cid = cid;
        this.region = region;
        this.model = model;
        this.mac = mac;
        this.configModule = configModule;
        this.lock = new async_lock_1.default();
        this.lastCheck = 0;
        this._mode = Mode.Manual;
        this._autoTargetHumidity = 0;
        this._idle = false;
        this._humidity = 0;
        this._speed = 1;
        this.manufacturer = 'Levoit';
        const deviceType = deviceTypes_1.humidifierDeviceTypes.find(({ isValid }) => isValid(this.model));
        if (!deviceType) {
            throw new Error(`Unsupported humidifier model: ${this.model}`);
        }
        this.deviceType = deviceType;
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
            manufacturer: this.manufacturer
        };
    }
    async setPower(power) {
        const success = await this.client.sendCommand(this, VeSync_1.HumidifierBypassMethod.SWITCH, {
            enabled: power,
            id: 0
        });
        if (success) {
            this._isOn = power;
        }
        return success;
    }
    async setTarget(value) {
        const success = await this.client.sendCommand(this, VeSync_1.HumidifierBypassMethod.HUMIDITY, {
            target_humidity: value,
            id: 0
        });
        if (success) {
            this._autoTargetHumidity = value;
        }
        return success;
    }
    async setMode(mode) {
        const success = await this.client.sendCommand(this, VeSync_1.HumidifierBypassMethod.MODE, {
            mode,
            id: 0
        });
        if (success) {
            this._mode = mode;
        }
        return success;
    }
    async setSpeed(value) {
        const success = await this.client.sendCommand(this, VeSync_1.HumidifierBypassMethod.MIST_LEVEL, {
            level: value,
            type: 'mist',
            id: 0
        });
        if (success) {
            this._speed = value;
            this._mode = Mode.Manual;
        }
        return success;
    }
    async updateInfo() {
        return this.lock.acquire('update-info', async () => {
            var _a, _b, _c, _d;
            try {
                if (Date.now() - this.lastCheck < this.client.deviceUpdateIntervalMs) {
                    return;
                }
                const data = await this.client.getDeviceInfo(this, true);
                this.lastCheck = Date.now();
                if (!((_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.result)) {
                    return;
                }
                const result = data.result.result;
                this._idle = ((_b = result.configuration) === null || _b === void 0 ? void 0 : _b.automatic_stop) && result.automatic_stop_reach_target;
                this._autoTargetHumidity = (_d = (_c = result.configuration) === null || _c === void 0 ? void 0 : _c.auto_target_humidity) !== null && _d !== void 0 ? _d : 0;
                this._speed = result.mist_virtual_level;
                this._humidity = result.humidity;
                this._isOn = result.enabled;
                this._mode = result.mode;
            }
            catch (err) {
                this.client.log.error(err === null || err === void 0 ? void 0 : err.message);
            }
        });
    }
}
VeSyncHumidifier.fromResponse = (client) => ({ deviceStatus, deviceName, uuid, cid, deviceRegion, deviceType, macID, configModule, }) => new VeSyncHumidifier(client, deviceName, uuid, deviceStatus === 'on', cid, deviceRegion, deviceType, macID, configModule);
exports.default = VeSyncHumidifier;
//# sourceMappingURL=VeSyncHumidifier.js.map