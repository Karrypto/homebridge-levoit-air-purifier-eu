"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = require("./platform");
const FilterChangeIndication_1 = __importDefault(require("./characteristics/FilterChangeIndication"));
const LockPhysicalControls_1 = __importDefault(require("./characteristics/LockPhysicalControls"));
const FilterLifeLevel_1 = __importDefault(require("./characteristics/FilterLifeLevel"));
const RotationSpeed_1 = __importDefault(require("./characteristics/RotationSpeed"));
const CurrentState_1 = __importDefault(require("./characteristics/CurrentState"));
const PM25Density_1 = __importDefault(require("./characteristics/PM25Density"));
const TargetState_1 = __importDefault(require("./characteristics/TargetState"));
const AirQuality_1 = __importDefault(require("./characteristics/AirQuality"));
const Active_1 = __importDefault(require("./characteristics/Active"));
const Display_1 = __importDefault(require("./experimentalCharacteristics/Display"));
class VeSyncPurAccessory {
    get UUID() {
        return this.device.uuid.toString();
    }
    get device() {
        return this.accessory.context.device;
    }
    constructor(platform, accessory, additional) {
        this.platform = platform;
        this.accessory = accessory;
        this.additional = additional;
        this.HomeAirQuality = this.platform.Characteristic.AirQuality;
        try {
            const { manufacturer, model, mac } = this.device;
            // Homebridge Best Practice: AccessoryInformation vollständig ausfüllen
            // Siehe: https://developers.homebridge.io/#/
            this.accessory
                .getService(this.platform.Service.AccessoryInformation)
                .setCharacteristic(this.platform.Characteristic.Manufacturer, manufacturer)
                .setCharacteristic(this.platform.Characteristic.Model, model)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, mac)
                .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0' // Plugin-Version als Firmware-Revision
            );
            this.airPurifierService =
                this.accessory.getService(this.platform.Service.AirPurifier) ||
                    this.accessory.addService(this.platform.Service.AirPurifier);
            // Homebridge Best Practice: Service-Name setzen für bessere Identifikation in der Home App
            this.airPurifierService.setCharacteristic(this.platform.Characteristic.Name, this.device.name);
            const sensor = additional[platform_1.VeSyncAdditionalType.Sensor];
            if (sensor) {
                sensor
                    .getService(this.platform.Service.AccessoryInformation)
                    .setCharacteristic(this.platform.Characteristic.Manufacturer, manufacturer)
                    .setCharacteristic(this.platform.Characteristic.Model, model)
                    .setCharacteristic(this.platform.Characteristic.SerialNumber, mac);
                const airQualitySensorService = sensor.getService(this.platform.Service.AirQualitySensor) ||
                    sensor.addService(this.platform.Service.AirQualitySensor);
                airQualitySensorService
                    .getCharacteristic(this.platform.Characteristic.AirQuality)
                    .setProps({
                    validValues: [
                        this.HomeAirQuality.UNKNOWN,
                        this.HomeAirQuality.EXCELLENT,
                        this.HomeAirQuality.GOOD,
                        this.HomeAirQuality.INFERIOR,
                        this.HomeAirQuality.POOR
                    ]
                })
                    .onGet(AirQuality_1.default.get.bind(this));
                if (this.device.deviceType.hasPM25) {
                    airQualitySensorService
                        .getCharacteristic(this.platform.Characteristic.PM2_5Density)
                        .onGet(PM25Density_1.default.get.bind(this));
                }
            }
            const legacySensor = this.accessory.getService(this.platform.Service.AirQualitySensor);
            if (legacySensor) {
                this.accessory.removeService(legacySensor);
            }
            const display = additional[platform_1.VeSyncAdditionalType.Light];
            if (display) {
                display
                    .getService(this.platform.Service.AccessoryInformation)
                    .setCharacteristic(this.platform.Characteristic.Manufacturer, manufacturer)
                    .setCharacteristic(this.platform.Characteristic.Model, model)
                    .setCharacteristic(this.platform.Characteristic.SerialNumber, mac);
                const displayLightService = display.getService(this.platform.Service.Lightbulb) ||
                    display.addService(this.platform.Service.Lightbulb);
                displayLightService
                    .getCharacteristic(this.platform.Characteristic.On)
                    .onGet(Display_1.default.get.bind(this))
                    .onSet(Display_1.default.set.bind(this));
            }
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(Active_1.default.get.bind(this))
                .onSet(Active_1.default.set.bind(this));
            this.airPurifierCurrentCharacteristic = this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
                .onGet(CurrentState_1.default.get.bind(this));
            if (this.device.deviceType.hasAutoMode) {
                this.airPurifierService
                    .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
                    .onGet(TargetState_1.default.get.bind(this))
                    .onSet(TargetState_1.default.set.bind(this));
            }
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
                .onGet(LockPhysicalControls_1.default.get.bind(this))
                .onSet(LockPhysicalControls_1.default.set.bind(this));
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .setProps({
                minStep: this.device.deviceType.speedMinStep,
                maxValue: 100
            })
                .onGet(RotationSpeed_1.default.get.bind(this))
                .onSet(RotationSpeed_1.default.set.bind(this));
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
                .onGet(FilterChangeIndication_1.default.get.bind(this));
            // Homebridge Best Practice: Props für FilterLifeLevel definieren
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
                .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 1
            })
                .onGet(FilterLifeLevel_1.default.get.bind(this));
        }
        catch (error) {
            this.platform.log.error(`Error: ${error === null || error === void 0 ? void 0 : error.message}`);
        }
    }
}
exports.default = VeSyncPurAccessory;
//# sourceMappingURL=VeSyncPurAccessory.js.map