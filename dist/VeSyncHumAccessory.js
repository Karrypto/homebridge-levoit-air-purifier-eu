"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const RelativeHumidityHumidifierThreshold_1 = __importDefault(require("./humidifierCharacteristics/RelativeHumidityHumidifierThreshold"));
const CurrentHumidifierDehumidifierState_1 = __importDefault(require("./humidifierCharacteristics/CurrentHumidifierDehumidifierState"));
const CurrentRelativeHumidity_1 = __importDefault(require("./humidifierCharacteristics/CurrentRelativeHumidity"));
const RotationSpeed_1 = __importDefault(require("./humidifierCharacteristics/RotationSpeed"));
const AutoMode_1 = __importDefault(require("./humidifierCharacteristics/AutoMode"));
const Active_1 = __importDefault(require("./humidifierCharacteristics/Active"));
class VeSyncHumAccessory {
    get UUID() {
        return this.device.uuid.toString();
    }
    async refreshState() {
        var _a, _b;
        await this.device.updateInfo();
        (_a = this.currentStateChar) === null || _a === void 0 ? void 0 : _a.updateValue(this.device.currentState);
        (_b = this.modeChar) === null || _b === void 0 ? void 0 : _b.updateValue(this.device.mode === 'auto' ? 1 : 0);
    }
    get device() {
        return this.accessory.context.device;
    }
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        try {
            const { manufacturer, model, mac } = this.device;
            (0, util_1.setAccessoryInformation)((0, util_1.requireService)(this.accessory.getService(this.platform.Service.AccessoryInformation), 'AccessoryInformation'), this.platform.Characteristic, {
                manufacturer,
                model,
                serialNumber: mac,
                firmwareRevision: this.device.model || '1.0.0'
            });
            this.humidifierService =
                this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
                    this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
            this.humidifierService.setCharacteristic(this.platform.Characteristic.Name, this.device.name);
            this.humidifierService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(Active_1.default.get.bind(this))
                .onSet(Active_1.default.set.bind(this));
            this.currentStateChar = this.humidifierService
                .getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
                .onGet(CurrentHumidifierDehumidifierState_1.default.get.bind(this));
            this.humidifierService
                .getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
                .setProps({
                minValue: 1,
                maxValue: 1,
                validValueRanges: [1, 1],
                validValues: [1]
            })
                .onGet(() => {
                return this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER;
            });
            this.humidifierService
                .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
                .onGet(CurrentRelativeHumidity_1.default.get.bind(this));
            if (this.device.deviceType.hasAutoMode) {
                this.humidifierService
                    .getCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)
                    .setProps({
                    maxValue: 80,
                    minValue: 30,
                })
                    .onGet(RelativeHumidityHumidifierThreshold_1.default.get.bind(this))
                    .onSet(RelativeHumidityHumidifierThreshold_1.default.set.bind(this));
                this.modeChar = this.humidifierService.getCharacteristic(this.platform.Characteristic.SwingMode)
                    .onGet(AutoMode_1.default.get.bind(this))
                    .onSet(AutoMode_1.default.set.bind(this));
            }
            this.humidifierService
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .setProps({
                minStep: this.device.deviceType.speedMinStep,
                maxValue: 100
            })
                .onGet(RotationSpeed_1.default.get.bind(this))
                .onSet(RotationSpeed_1.default.set.bind(this));
        }
        catch (error) {
            this.platform.log.error(`Error: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
    }
}
exports.default = VeSyncHumAccessory;
//# sourceMappingURL=VeSyncHumAccessory.js.map