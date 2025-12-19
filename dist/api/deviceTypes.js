"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.humidifierDeviceTypes = exports.HumidifierDeviceName = exports.DeviceName = void 0;
var DeviceName;
(function (DeviceName) {
    DeviceName["Core602S"] = "602S";
    DeviceName["Core601S"] = "601S";
    DeviceName["Core600S"] = "600S";
    DeviceName["Core401S"] = "401S";
    DeviceName["Core400S"] = "400S";
    DeviceName["Core303S"] = "303S";
    DeviceName["Core302S"] = "302S";
    DeviceName["Core301S"] = "301S";
    DeviceName["Core300S"] = "300S";
    DeviceName["Core201S"] = "201S";
    DeviceName["Core200S"] = "200S";
    DeviceName["Vital100S"] = "V102S";
    DeviceName["Vital200S"] = "V201S";
})(DeviceName || (exports.DeviceName = DeviceName = {}));
var HumidifierDeviceName;
(function (HumidifierDeviceName) {
    HumidifierDeviceName["Dual200SLeg"] = "Dual200S";
    HumidifierDeviceName["Dual200S"] = "D301S";
})(HumidifierDeviceName || (exports.HumidifierDeviceName = HumidifierDeviceName = {}));
const normalize = (input) => (input !== null && input !== void 0 ? input : '').toUpperCase();
const deviceTypes = [
    {
        isValid: (input) => {
            const i = normalize(input);
            return (i.includes(DeviceName.Core602S) ||
                i.includes(DeviceName.Core601S) ||
                i.includes(DeviceName.Core600S) ||
                i.includes(DeviceName.Core401S) ||
                i.includes(DeviceName.Core400S));
        },
        hasAirQuality: true,
        hasAutoMode: true,
        speedMinStep: 20,
        speedLevels: 5,
        hasPM25: true
    },
    {
        isValid: (input) => {
            const i = normalize(input);
            // 300S Pro: je nach API/Region tauchen unterschiedliche Modelstrings auf,
            // daher etwas toleranter matchen.
            return (i.includes(DeviceName.Core303S) || // 300S Pro (z.B. "...303S...")
                i.includes('300S PRO') ||
                i.includes('300SPRO') ||
                i.includes(DeviceName.Core302S) ||
                i.includes(DeviceName.Core301S) ||
                i.includes(DeviceName.Core300S));
        },
        hasAirQuality: true,
        hasAutoMode: true,
        speedMinStep: 25,
        speedLevels: 4,
        hasPM25: true
    },
    {
        isValid: (input) => {
            const i = normalize(input);
            return ((i.includes(DeviceName.Core201S) && !i.includes(DeviceName.Vital200S)) ||
                i.includes(DeviceName.Core200S));
        },
        hasAirQuality: false,
        hasAutoMode: false,
        speedMinStep: 25,
        speedLevels: 4,
        hasPM25: false
    },
    {
        isValid: (input) => {
            const i = normalize(input);
            return i.includes(DeviceName.Vital100S) || i.includes(DeviceName.Vital200S);
        },
        hasAirQuality: true,
        hasAutoMode: true,
        speedMinStep: 25,
        speedLevels: 4,
        hasPM25: true
    },
];
exports.humidifierDeviceTypes = [
    {
        isValid: (input) => {
            const i = normalize(input);
            return i.includes(HumidifierDeviceName.Dual200S) || i.includes(HumidifierDeviceName.Dual200SLeg);
        },
        hasAutoMode: true,
        speedMinStep: 50,
        speedLevels: 2,
        isHumidifier: true
    }
];
exports.default = deviceTypes;
//# sourceMappingURL=deviceTypes.js.map