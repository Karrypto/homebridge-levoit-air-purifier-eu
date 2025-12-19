"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VeSyncHumidifier_1 = require("../api/VeSyncHumidifier");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.mode === VeSyncHumidifier_1.Mode.Auto ? 1 : 0;
    },
    set: async function (value) {
        const mode = value === 1 ? VeSyncHumidifier_1.Mode.Auto : VeSyncHumidifier_1.Mode.Manual;
        if (mode !== this.device.mode) {
            await this.device.setMode(mode);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=AutoMode.js.map