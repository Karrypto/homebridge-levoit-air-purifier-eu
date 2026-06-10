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
const util_1 = require("./util");
const VeSyncFan_1 = require("./api/VeSyncFan");
const airPurifierState_1 = require("./characteristics/airPurifierState");
const Display_1 = __importDefault(require("./experimentalCharacteristics/Display"));
class VeSyncPurAccessory {
    get UUID() {
        return this.device.uuid.toString();
    }
    async refreshState() {
        var _a, _b, _c, _d;
        await this.device.updateInfo();
        (_a = this.airPurifierActiveCharacteristic) === null || _a === void 0 ? void 0 : _a.updateValue(this.device.isOn
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE);
        (_b = this.airPurifierCurrentCharacteristic) === null || _b === void 0 ? void 0 : _b.updateValue(this.device.isOn
            ? this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
            : this.platform.Characteristic.CurrentAirPurifierState.INACTIVE);
        (_c = this.airPurifierRotationSpeedCharacteristic) === null || _c === void 0 ? void 0 : _c.updateValue((0, airPurifierState_1.getPurifierRotationSpeed)(this.device));
        if (this.device.deviceType.hasAutoMode) {
            const { AUTO, MANUAL } = this.platform.Characteristic.TargetAirPurifierState;
            (_d = this.airPurifierTargetCharacteristic) === null || _d === void 0 ? void 0 : _d.updateValue(this.device.mode === VeSyncFan_1.Mode.Auto ? AUTO : MANUAL);
        }
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
            (0, util_1.setAccessoryInformation)((0, util_1.requireService)(this.accessory.getService(this.platform.Service.AccessoryInformation), 'AccessoryInformation'), this.platform.Characteristic, {
                manufacturer,
                model,
                serialNumber: mac,
                firmwareRevision: this.device.model || '1.0.0'
            });
            this.airPurifierService =
                this.accessory.getService(this.platform.Service.AirPurifier) ||
                    this.accessory.addService(this.platform.Service.AirPurifier);
            this.airPurifierService.setCharacteristic(this.platform.Characteristic.Name, this.device.name);
            const sensor = additional[platform_1.VeSyncAdditionalType.Sensor];
            if (sensor) {
                (0, util_1.setAccessoryInformation)((0, util_1.requireService)(sensor.getService(this.platform.Service.AccessoryInformation), 'Sensor AccessoryInformation'), this.platform.Characteristic, {
                    manufacturer,
                    model,
                    serialNumber: mac
                });
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
                (0, util_1.setAccessoryInformation)((0, util_1.requireService)(display.getService(this.platform.Service.AccessoryInformation), 'Display AccessoryInformation'), this.platform.Characteristic, {
                    manufacturer,
                    model,
                    serialNumber: mac
                });
                const displayLightService = display.getService(this.platform.Service.Lightbulb) ||
                    display.addService(this.platform.Service.Lightbulb);
                displayLightService
                    .getCharacteristic(this.platform.Characteristic.On)
                    .onGet(Display_1.default.get.bind(this))
                    .onSet(Display_1.default.set.bind(this));
            }
            this.airPurifierActiveCharacteristic = this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(Active_1.default.get.bind(this))
                .onSet(Active_1.default.set.bind(this));
            this.airPurifierCurrentCharacteristic = this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
                .onGet(CurrentState_1.default.get.bind(this));
            if (this.device.deviceType.hasAutoMode) {
                this.airPurifierTargetCharacteristic = this.airPurifierService
                    .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
                    .onGet(TargetState_1.default.get.bind(this))
                    .onSet(TargetState_1.default.set.bind(this));
            }
            this.airPurifierService
                .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
                .onGet(LockPhysicalControls_1.default.get.bind(this))
                .onSet(LockPhysicalControls_1.default.set.bind(this));
            this.airPurifierRotationSpeedCharacteristic = this.airPurifierService
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