"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VeSyncFan_1 = require("../api/VeSyncFan");
const characteristic = {
    get: async function () {
        const { MANUAL, AUTO } = this.platform.Characteristic.TargetAirPurifierState;
        if (!this.device.deviceType.hasAutoMode) {
            return MANUAL;
        }
        await this.device.updateInfo();
        return this.device.mode === VeSyncFan_1.Mode.Auto ? AUTO : MANUAL;
    },
    set: async function (value) {
        if (!this.device.deviceType.hasAutoMode) {
            return;
        }
        const { MANUAL, AUTO } = this.platform.Characteristic.TargetAirPurifierState;
        switch (value) {
            case AUTO:
                if (this.device.mode !== VeSyncFan_1.Mode.Auto) {
                    await this.device.changeMode(VeSyncFan_1.Mode.Auto);
                }
                break;
            case MANUAL:
                if (this.device.mode !== VeSyncFan_1.Mode.Manual) {
                    await this.device.changeMode(VeSyncFan_1.Mode.Manual);
                }
                break;
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=TargetState.js.map