"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
    get device() {
        return this.accessory.context.device;
    }
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        try {
            const { manufacturer, model, mac } = this.device;
            // Homebridge Best Practice: AccessoryInformation vollständig ausfüllen
            this.accessory
                .getService(this.platform.Service.AccessoryInformation)
                .setCharacteristic(this.platform.Characteristic.Manufacturer, manufacturer)
                .setCharacteristic(this.platform.Characteristic.Model, model)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, mac)
                .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.device.model || '1.0.0');
            this.humidifierService =
                this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
                    this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
            // Homebridge Best Practice: Service-Name setzen
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
                    maxValue: 110,
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