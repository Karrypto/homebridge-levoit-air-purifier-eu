"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VeSyncFan_1 = require("../api/VeSyncFan");
const characteristic = {
    get: async function () {
        if (!this.device.deviceType.hasAirQuality) {
            return this.HomeAirQuality.UNKNOWN;
        }
        await this.device.updateInfo();
        switch (this.device.airQualityLevel) {
            case VeSyncFan_1.AirQuality.VERY_GOOD:
                return this.HomeAirQuality.EXCELLENT;
            case VeSyncFan_1.AirQuality.GOOD:
                return this.HomeAirQuality.GOOD;
            case VeSyncFan_1.AirQuality.MODERATE:
                return this.HomeAirQuality.INFERIOR;
            case VeSyncFan_1.AirQuality.POOR:
                return this.HomeAirQuality.POOR;
            default:
                return this.HomeAirQuality.UNKNOWN;
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=AirQuality.js.map